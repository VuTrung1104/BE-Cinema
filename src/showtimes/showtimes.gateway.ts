import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface SeatLock {
  seatId: string;
  userId: string;
  socketId: string;
  lockedAt: Date;
  expiresAt: Date;
}

interface JoinShowtimeDto {
  showtimeId: string;
  userId: string;
}

interface LockSeatsDto {
  showtimeId: string;
  seatIds: string[];
  userId: string;
}

interface UnlockSeatsDto {
  showtimeId: string;
  seatIds: string[];
}

@WebSocketGateway({
  cors: {
    origin: '*', // Adjust for production
    credentials: true,
  },
  namespace: '/showtimes',
})
export class ShowtimesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger(ShowtimesGateway.name);
  
  // Track locked seats: Map<showtimeId, Map<seatId, SeatLock>>
  private seatLocks = new Map<string, Map<string, SeatLock>>();
  
  // Track user rooms: Map<socketId, showtimeId>
  private userRooms = new Map<string, string>();
  
  // Lock duration in milliseconds (15 minutes)
  private readonly LOCK_DURATION = 15 * 60 * 1000;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Get showtime room this client was in
    const showtimeId = this.userRooms.get(client.id);
    
    if (showtimeId) {
      // Unlock all seats locked by this client
      this.unlockSeatsBySocket(showtimeId, client.id);
      this.userRooms.delete(client.id);
    }
  }

  @SubscribeMessage('joinShowtime')
  handleJoinShowtime(
    @MessageBody() data: JoinShowtimeDto,
    @ConnectedSocket() client: Socket,
  ) {
    const { showtimeId, userId } = data;

    // Leave previous room if any
    const previousRoom = this.userRooms.get(client.id);
    if (previousRoom) {
      client.leave(previousRoom);
      this.unlockSeatsBySocket(previousRoom, client.id);
    }

    // Join new showtime room
    client.join(showtimeId);
    this.userRooms.set(client.id, showtimeId);

    // Initialize seat locks for this showtime if not exists
    if (!this.seatLocks.has(showtimeId)) {
      this.seatLocks.set(showtimeId, new Map());
    }

    // Send current locked seats to the client
    const lockedSeats = this.getLockedSeats(showtimeId);
    
    this.logger.log(`User ${userId} (${client.id}) joined showtime ${showtimeId}`);
    
    return {
      success: true,
      message: `Joined showtime ${showtimeId}`,
      lockedSeats,
    };
  }

  @SubscribeMessage('leaveShowtime')
  handleLeaveShowtime(
    @MessageBody() data: { showtimeId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { showtimeId } = data;

    // Unlock all seats locked by this client
    this.unlockSeatsBySocket(showtimeId, client.id);

    // Leave room
    client.leave(showtimeId);
    this.userRooms.delete(client.id);

    this.logger.log(`Client ${client.id} left showtime ${showtimeId}`);

    return {
      success: true,
      message: `Left showtime ${showtimeId}`,
    };
  }

  @SubscribeMessage('lockSeats')
  handleLockSeats(
    @MessageBody() data: LockSeatsDto,
    @ConnectedSocket() client: Socket,
  ) {
    const { showtimeId, seatIds, userId } = data;

    if (!this.seatLocks.has(showtimeId)) {
      this.seatLocks.set(showtimeId, new Map());
    }

    const showtimeLocks = this.seatLocks.get(showtimeId);
    const lockedSeats: string[] = [];
    const failedSeats: string[] = [];
    const now = new Date();

    for (const seatId of seatIds) {
      const existingLock = showtimeLocks.get(seatId);

      // Check if seat is already locked by someone else
      if (existingLock) {
        // Check if lock has expired
        if (existingLock.expiresAt < now) {
          // Lock expired, remove it
          showtimeLocks.delete(seatId);
        } else if (existingLock.socketId !== client.id) {
          // Still locked by someone else
          failedSeats.push(seatId);
          continue;
        }
      }

      // Lock the seat
      const lock: SeatLock = {
        seatId,
        userId,
        socketId: client.id,
        lockedAt: now,
        expiresAt: new Date(now.getTime() + this.LOCK_DURATION),
      };

      showtimeLocks.set(seatId, lock);
      lockedSeats.push(seatId);

      // Set timeout to auto-unlock after expiration
      setTimeout(() => {
        this.autoUnlockSeat(showtimeId, seatId, client.id);
      }, this.LOCK_DURATION);
    }

    // Broadcast updated locked seats to all clients in the room
    if (lockedSeats.length > 0) {
      this.server.to(showtimeId).emit('seatsLocked', {
        seatIds: lockedSeats,
        userId,
        socketId: client.id,
      });
    }

    this.logger.log(
      `User ${userId} locked seats: ${lockedSeats.join(', ')} in showtime ${showtimeId}`,
    );

    return {
      success: true,
      lockedSeats,
      failedSeats,
      message: `Locked ${lockedSeats.length} seats, failed ${failedSeats.length} seats`,
    };
  }

  @SubscribeMessage('unlockSeats')
  handleUnlockSeats(
    @MessageBody() data: UnlockSeatsDto,
    @ConnectedSocket() client: Socket,
  ) {
    const { showtimeId, seatIds } = data;

    if (!this.seatLocks.has(showtimeId)) {
      return {
        success: false,
        message: 'Showtime not found',
      };
    }

    const showtimeLocks = this.seatLocks.get(showtimeId);
    const unlockedSeats: string[] = [];

    for (const seatId of seatIds) {
      const lock = showtimeLocks.get(seatId);

      // Only allow unlocking own seats
      if (lock && lock.socketId === client.id) {
        showtimeLocks.delete(seatId);
        unlockedSeats.push(seatId);
      }
    }

    // Broadcast unlocked seats to all clients in the room
    if (unlockedSeats.length > 0) {
      this.server.to(showtimeId).emit('seatsUnlocked', {
        seatIds: unlockedSeats,
        socketId: client.id,
      });
    }

    this.logger.log(`Client ${client.id} unlocked seats: ${unlockedSeats.join(', ')}`);

    return {
      success: true,
      unlockedSeats,
      message: `Unlocked ${unlockedSeats.length} seats`,
    };
  }

  // Helper methods
  private getLockedSeats(showtimeId: string): Array<{ seatId: string; userId: string }> {
    if (!this.seatLocks.has(showtimeId)) {
      return [];
    }

    const showtimeLocks = this.seatLocks.get(showtimeId);
    const now = new Date();
    const lockedSeats = [];

    for (const [seatId, lock] of showtimeLocks.entries()) {
      // Only return non-expired locks
      if (lock.expiresAt > now) {
        lockedSeats.push({
          seatId,
          userId: lock.userId,
        });
      }
    }

    return lockedSeats;
  }

  private unlockSeatsBySocket(showtimeId: string, socketId: string) {
    if (!this.seatLocks.has(showtimeId)) {
      return;
    }

    const showtimeLocks = this.seatLocks.get(showtimeId);
    const unlockedSeats: string[] = [];

    for (const [seatId, lock] of showtimeLocks.entries()) {
      if (lock.socketId === socketId) {
        showtimeLocks.delete(seatId);
        unlockedSeats.push(seatId);
      }
    }

    // Broadcast unlocked seats
    if (unlockedSeats.length > 0) {
      this.server.to(showtimeId).emit('seatsUnlocked', {
        seatIds: unlockedSeats,
        socketId,
        reason: 'disconnect',
      });

      this.logger.log(`Auto-unlocked ${unlockedSeats.length} seats for socket ${socketId}`);
    }
  }

  private autoUnlockSeat(showtimeId: string, seatId: string, socketId: string) {
    if (!this.seatLocks.has(showtimeId)) {
      return;
    }

    const showtimeLocks = this.seatLocks.get(showtimeId);
    const lock = showtimeLocks.get(seatId);

    // Only auto-unlock if still locked by the same socket
    if (lock && lock.socketId === socketId) {
      showtimeLocks.delete(seatId);

      // Broadcast unlock event
      this.server.to(showtimeId).emit('seatsUnlocked', {
        seatIds: [seatId],
        socketId,
        reason: 'expired',
      });

      this.logger.log(`Auto-unlocked seat ${seatId} in showtime ${showtimeId} (expired)`);
    }
  }
}
