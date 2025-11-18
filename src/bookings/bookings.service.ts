import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { Booking, BookingDocument, BookingStatus } from './schemas/booking.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ShowtimesService } from '../showtimes/showtimes.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectConnection() private connection: Connection,
    private showtimesService: ShowtimesService,
    private redisService: RedisService,
  ) {}

  async create(userId: string, createBookingDto: CreateBookingDto) {
    const { showtimeId, seats } = createBookingDto;

    // Start a database transaction
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Step 1: Try to lock seats in Redis
      const lockAcquired = await this.redisService.lockSeats(
        showtimeId,
        seats,
        userId,
        600, // 10 minutes TTL
      );

      if (!lockAcquired) {
        throw new BadRequestException(
          'One or more seats are currently being reserved by another user. Please try again.',
        );
      }

      this.logger.log(`Seats locked for user ${userId}: ${seats.join(', ')}`);

      // Step 2: Get showtime details
      const showtime = await this.showtimesService.findOne(showtimeId);

      // Step 3: Check if seats are available in database
      const unavailableSeats = seats.filter(seat => 
        showtime.bookedSeats.includes(seat)
      );

      if (unavailableSeats.length > 0) {
        // Release locks before throwing error
        await this.redisService.unlockSeats(showtimeId, seats, userId);
        throw new BadRequestException(
          `Seats ${unavailableSeats.join(', ')} are already booked`
        );
      }

      // Step 4: Calculate total price
      const totalPrice = seats.length * showtime.price;

      // Step 5: Generate unique booking code
      const bookingCode = this.generateBookingCode();

      // Step 6: Create booking (within transaction)
      const booking = new this.bookingModel({
        userId,
        showtimeId,
        seats,
        totalPrice,
        bookingCode,
        status: BookingStatus.PENDING,
      });

      await booking.save({ session });

      // Step 7: Book seats in showtime (within transaction)
      await this.showtimesService.bookSeats(showtimeId, seats);

      // Commit transaction
      await session.commitTransaction();
      
      this.logger.log(`Booking created successfully: ${bookingCode}`);

      return booking;

    } catch (error) {
      // Rollback transaction on any error
      await session.abortTransaction();
      
      // Release Redis locks
      await this.redisService.unlockSeats(showtimeId, seats, userId);
      
      this.logger.error(`Booking creation failed: ${error.message}`);
      throw error;

    } finally {
      // End session
      session.endSession();
    }
  }

  async findAll(userId?: string) {
    const query = userId ? { userId } : {};
    return this.bookingModel
      .find(query)
      .populate({
        path: 'showtimeId',
        populate: [
          { path: 'movieId' },
          { path: 'theaterId' }
        ]
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string) {
    const booking = await this.bookingModel
      .findById(id)
      .populate({
        path: 'showtimeId',
        populate: [
          { path: 'movieId' },
          { path: 'theaterId' }
        ]
      })
      .exec();

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return booking;
  }

  async findByCode(bookingCode: string) {
    const booking = await this.bookingModel
      .findOne({ bookingCode })
      .populate({
        path: 'showtimeId',
        populate: [
          { path: 'movieId' },
          { path: 'theaterId' }
        ]
      })
      .exec();

    if (!booking) {
      throw new NotFoundException(`Booking with code ${bookingCode} not found`);
    }

    return booking;
  }

  async confirmBooking(id: string) {
    const booking = await this.bookingModel.findById(id);
    
    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Booking is not in pending status');
    }

    booking.status = BookingStatus.CONFIRMED;
    await booking.save();

    // Release Redis locks when booking is confirmed (payment completed)
    await this.redisService.unlockSeats(
      booking.showtimeId.toString(),
      booking.seats,
      booking.userId.toString(),
    );

    this.logger.log(`Booking confirmed and locks released: ${booking.bookingCode}`);

    return booking;
  }

  async cancelBooking(id: string) {
    const booking = await this.bookingModel.findById(id);
    
    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    // Release the booked seats in database
    await this.showtimesService.releaseSeats(
      booking.showtimeId.toString(),
      booking.seats,
    );

    // Release Redis locks
    await this.redisService.unlockSeats(
      booking.showtimeId.toString(),
      booking.seats,
      booking.userId.toString(),
    );

    booking.status = BookingStatus.CANCELLED;
    await booking.save();

    this.logger.log(`Booking cancelled and locks released: ${booking.bookingCode}`);

    return booking;
  }

  /**
   * Extend seat lock TTL - useful when user needs more time
   */
  async extendSeatLock(bookingId: string, userId: string): Promise<void> {
    const booking = await this.bookingModel.findById(bookingId);
    
    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    if (booking.userId.toString() !== userId) {
      throw new BadRequestException('You can only extend your own bookings');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Can only extend pending bookings');
    }

    const extendedCount = await this.redisService.extendSeatLock(
      booking.showtimeId.toString(),
      booking.seats,
      userId,
      600, // Extend by another 10 minutes
    );

    this.logger.log(`Extended lock for ${extendedCount} seats`);
  }

  /**
   * Check remaining time for seat locks
   */
  async checkSeatLockStatus(showtimeId: string, seats: string[]): Promise<any> {
    const lockedSeats = await this.redisService.checkLockedSeats(showtimeId, seats);
    const ttls: { [seat: string]: number } = {};

    for (const seat of seats) {
      ttls[seat] = await this.redisService.getSeatLockTTL(showtimeId, seat);
    }

    return { lockedSeats, ttls };
  }

  private generateBookingCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
