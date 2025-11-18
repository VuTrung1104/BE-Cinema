import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);

    this.client = new Redis({
      host: redisHost,
      port: redisPort,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /**
   * Lock seats for a specific showtime with TTL (Time To Live)
   * @param showtimeId - The showtime ID
   * @param seats - Array of seat identifiers to lock
   * @param userId - User ID who is locking the seats
   * @param ttlSeconds - Time to live in seconds (default 10 minutes)
   * @returns true if all seats were locked successfully, false otherwise
   */
  async lockSeats(
    showtimeId: string,
    seats: string[],
    userId: string,
    ttlSeconds: number = 600, // 10 minutes default
  ): Promise<boolean> {
    try {
      const pipeline = this.client.pipeline();

      for (const seat of seats) {
        const key = `seat:lock:${showtimeId}:${seat}`;
        // NX = only set if not exists, EX = expire in seconds
        pipeline.set(key, userId, 'EX', ttlSeconds, 'NX');
      }

      const results = await pipeline.exec();

      // Check if all seats were locked successfully
      // Result format: [Error | null, 'OK' | null][]
      return results.every((result) => result[1] === 'OK');
    } catch (error) {
      this.logger.error(`Redis lockSeats failed: ${error.message}`, error.stack);
      // Return false to indicate lock failed, allowing graceful degradation
      return false;
    }
  }

  /**
   * Check if seats are currently locked
   * @param showtimeId - The showtime ID
   * @param seats - Array of seat identifiers to check
   * @returns Object with locked seats and their owners
   */
  async checkLockedSeats(
    showtimeId: string,
    seats: string[],
  ): Promise<{ [seat: string]: string | null }> {
    try {
      const pipeline = this.client.pipeline();

      for (const seat of seats) {
        const key = `seat:lock:${showtimeId}:${seat}`;
        pipeline.get(key);
      }

      const results = await pipeline.exec();
      const lockedSeats: { [seat: string]: string | null } = {};

      seats.forEach((seat, index) => {
        lockedSeats[seat] = results[index][1] as string | null;
      });

      return lockedSeats;
    } catch (error) {
      this.logger.error(`Redis checkLockedSeats failed: ${error.message}`, error.stack);
      // Return empty object, assuming no locks if Redis is down
      return {};
    }
  }

  /**
   * Release seat locks
   * @param showtimeId - The showtime ID
   * @param seats - Array of seat identifiers to unlock
   * @param userId - User ID who locked the seats (for verification)
   * @returns Number of seats successfully unlocked
   */
  async unlockSeats(
    showtimeId: string,
    seats: string[],
    userId: string,
  ): Promise<number> {
    try {
      let unlockedCount = 0;

      for (const seat of seats) {
        const key = `seat:lock:${showtimeId}:${seat}`;
        const owner = await this.client.get(key);

        // Only unlock if the user is the owner
        if (owner === userId) {
          await this.client.del(key);
          unlockedCount++;
        }
      }

      return unlockedCount;
    } catch (error) {
      this.logger.error(`Redis unlockSeats failed: ${error.message}`, error.stack);
      // Return 0 to indicate no seats were unlocked
      return 0;
    }
  }

  /**
   * Extend the TTL of existing seat locks
   * @param showtimeId - The showtime ID
   * @param seats - Array of seat identifiers
   * @param userId - User ID who locked the seats
   * @param ttlSeconds - New TTL in seconds
   * @returns Number of seats with extended TTL
   */
  async extendSeatLock(
    showtimeId: string,
    seats: string[],
    userId: string,
    ttlSeconds: number = 600,
  ): Promise<number> {
    let extendedCount = 0;

    for (const seat of seats) {
      const key = `seat:lock:${showtimeId}:${seat}`;
      const owner = await this.client.get(key);

      // Only extend if the user is the owner
      if (owner === userId) {
        await this.client.expire(key, ttlSeconds);
        extendedCount++;
      }
    }

    return extendedCount;
  }

  /**
   * Get remaining TTL for a seat lock
   * @param showtimeId - The showtime ID
   * @param seat - Seat identifier
   * @returns TTL in seconds, -1 if no expiration, -2 if key doesn't exist
   */
  async getSeatLockTTL(showtimeId: string, seat: string): Promise<number> {
    const key = `seat:lock:${showtimeId}:${seat}`;
    return this.client.ttl(key);
  }

  /**
   * Generic set with expiration
   */
  async setWithExpiry(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  /**
   * Generic get
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Generic delete
   */
  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  /**
   * Get Redis client instance for advanced operations
   */
  getClient(): Redis {
    return this.client;
  }
}
