import { Injectable, NotFoundException, BadRequestException, Logger, ConflictException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Booking, BookingDocument, BookingStatus } from './schemas/booking.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ShowtimesService } from '../showtimes/showtimes.service';
import { QRCodeService } from '../common/services/qrcode.service';
import { EmailService } from '../common/services/email.service';
import { Showtime, ShowtimeDocument } from '../showtimes/schemas/showtime.schema';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Showtime.name) private showtimeModel: Model<ShowtimeDocument>,
    @InjectConnection() private connection: Connection,
    private showtimesService: ShowtimesService,
    private qrcodeService: QRCodeService,
    private emailService: EmailService,
  ) {}

  /**
   * Lock seats temporarily using MongoDB (replaces Redis)
   * Uses atomic operation to prevent race conditions
   */
  private async lockSeatsInDB(
    showtimeId: string,
    seats: string[],
    userId: string,
    ttlMinutes: number = 10,
  ): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const now = new Date();

    try {
      // First, remove expired locks
      await this.showtimeModel.updateOne(
        { _id: showtimeId },
        {
          $pull: {
            tempLockedSeats: { expiresAt: { $lt: now } },
          },
        },
      );

      // Prepare new locks
      const newLocks = seats.map((seat) => ({
        seat,
        userId: new Types.ObjectId(userId),
        expiresAt,
      }));

      // Atomic operation: Lock seats only if they are not already locked or booked
      const result = await this.showtimeModel.updateOne(
        {
          _id: showtimeId,
          // Check seats are not booked
          bookedSeats: { $nin: seats },
          // Check seats are not temporarily locked by others
          'tempLockedSeats.seat': { $nin: seats },
        },
        {
          $push: {
            tempLockedSeats: { $each: newLocks },
          },
        },
      );

      const success = result.modifiedCount > 0;
      if (success) {
        this.logger.log(`Seats locked in DB for user ${userId}: ${seats.join(', ')}`);
      } else {
        this.logger.warn(`Failed to lock seats for user ${userId}: seats may be taken`);
      }
      return success;
    } catch (error) {
      this.logger.error(`Error locking seats: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Unlock seats after booking completion or cancellation
   */
  private async unlockSeatsInDB(
    showtimeId: string,
    seats: string[],
    userId: string,
  ): Promise<void> {
    try {
      await this.showtimeModel.updateOne(
        { _id: showtimeId },
        {
          $pull: {
            tempLockedSeats: {
              seat: { $in: seats },
              userId: new Types.ObjectId(userId),
            },
          },
        },
      );
      this.logger.log(`Seats unlocked for user ${userId}: ${seats.join(', ')}`);
    } catch (error) {
      this.logger.error(`Error unlocking seats: ${error.message}`, error.stack);
    }
  }

  /**
   * Check which seats are currently locked
   */
  private async checkLockedSeatsInDB(
    showtimeId: string,
    seats: string[],
  ): Promise<string[]> {
    const now = new Date();
    
    // First remove expired locks
    await this.showtimeModel.updateOne(
      { _id: showtimeId },
      {
        $pull: {
          tempLockedSeats: { expiresAt: { $lt: now } },
        },
      },
    );

    const showtime = await this.showtimeModel.findById(showtimeId);
    if (!showtime) return [];

    const lockedSeats = showtime.tempLockedSeats
      .filter((lock) => seats.includes(lock.seat) && lock.expiresAt > now)
      .map((lock) => lock.seat);

    return lockedSeats;
  }

  async create(userId: string, createBookingDto: CreateBookingDto) {
    const { showtimeId, seats } = createBookingDto;

    // Start a database transaction for atomicity
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Step 1: Try to lock seats in MongoDB (prevents race conditions)
      const lockAcquired = await this.lockSeatsInDB(
        showtimeId,
        seats,
        userId,
        10, // 10 minutes TTL
      );

      if (!lockAcquired) {
        throw new ConflictException(
          'One or more seats are currently being reserved by another user. Please try again.',
        );
      }

      // Step 2: Get showtime details
      const showtime = await this.showtimesService.findOne(showtimeId);

      // Step 3: Check if seats are available in database (double-check)
      const unavailableSeats = seats.filter(seat => 
        showtime.bookedSeats.includes(seat)
      );

      if (unavailableSeats.length > 0) {
        // Release locks before throwing error
        await this.unlockSeatsInDB(showtimeId, seats, userId);
        throw new BadRequestException(
          `Seats ${unavailableSeats.join(', ')} are already booked`
        );
      }

      // Step 4: Calculate total price
      const totalPrice = seats.length * showtime.price;

      // Step 5: Generate unique booking code
      const bookingCode = this.generateBookingCode();

      // Step 6: Create booking within transaction (not yet committed)
      const booking = new this.bookingModel({
        userId,
        showtimeId,
        seats,
        totalPrice,
        bookingCode,
        status: BookingStatus.PENDING,
      });

      await booking.save({ session });

      // Step 7: Book seats in showtime within same transaction (not yet committed)
      await this.showtimesService.bookSeats(showtimeId, seats);

      // CRITICAL: Commit transaction - both booking and seat booking succeed together
      await session.commitTransaction();
      
      this.logger.log(`Booking created successfully: ${bookingCode}`);

      return booking;

    } catch (error) {
      // CRITICAL: Rollback transaction on ANY error
      // This ensures booking is not saved if seat booking fails
      await session.abortTransaction();
      
      // Release MongoDB locks on failure
      try {
        await this.unlockSeatsInDB(showtimeId, seats, userId);
      } catch (unlockError) {
        this.logger.error(`Failed to unlock seats on error: ${unlockError.message}`);
      }
      
      this.logger.error(`Booking creation failed: ${error.message}`);
      throw error;

    } finally {
      // Always end session to free resources
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
    const booking = await this.bookingModel.findById(id)
      .populate({
        path: 'showtimeId',
        populate: [
          { path: 'movieId' },
          { path: 'theaterId' }
        ]
      })
      .populate('userId')
      .exec();
    
    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Booking is not in pending status');
    }

    booking.status = BookingStatus.CONFIRMED;
    await booking.save();

    // Release MongoDB locks when booking is confirmed (payment completed)
    await this.unlockSeatsInDB(
      booking.showtimeId.toString(),
      booking.seats,
      booking.userId.toString(),
    );

    // Generate QR code for booking
    try {
      const qrCodeData = {
        bookingId: booking._id.toString(),
        bookingCode: booking.bookingCode,
        userId: booking.userId._id.toString(),
        showtimeId: booking.showtimeId._id.toString(),
        seats: booking.seats,
        totalPrice: booking.totalPrice,
        timestamp: Date.now(),
      };

      const qrCodeUrl = await this.qrcodeService.generateQRCodeDataURL(qrCodeData);

      // Send booking confirmation email with QR code
      const showtime = booking.showtimeId as any;
      const movie = showtime.movieId as any;
      const theater = showtime.theaterId as any;
      const user = booking.userId as any;

      await this.emailService.sendBookingConfirmation({
        email: user.email,
        fullName: user.fullName,
        bookingCode: booking.bookingCode,
        qrCodeUrl,
        movieTitle: movie.title,
        movieDuration: movie.duration,
        movieGenre: Array.isArray(movie.genre) ? movie.genre.join(', ') : movie.genre,
        theaterName: theater.name,
        theaterLocation: theater.location || theater.address || 'N/A',
        screenName: showtime.screenName || 'Main Screen',
        showtimeDate: new Date(showtime.startTime).toLocaleDateString('vi-VN'),
        showtimeTime: new Date(showtime.startTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        seats: booking.seats,
        totalPrice: booking.totalPrice,
      });

      this.logger.log(`Booking confirmed, QR code generated, and email sent: ${booking.bookingCode}`);
    } catch (error) {
      this.logger.error(`Failed to send booking confirmation email: ${error.message}`);
      // Don't fail the booking confirmation if email fails
    }

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

    // Release MongoDB locks
    await this.unlockSeatsInDB(
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

    // Extend lock by updating expiration time in MongoDB
    const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const result = await this.showtimeModel.updateMany(
      {
        _id: booking.showtimeId,
        'tempLockedSeats.seat': { $in: booking.seats },
        'tempLockedSeats.userId': new Types.ObjectId(userId),
      },
      {
        $set: {
          'tempLockedSeats.$[elem].expiresAt': newExpiresAt,
        },
      },
      {
        arrayFilters: [{ 'elem.userId': new Types.ObjectId(userId) }],
      },
    );

    this.logger.log(`Extended lock for ${result.modifiedCount} seats`);
  }

  /**
   * Check remaining time for seat locks
   */
  async checkSeatLockStatus(showtimeId: string, seats: string[]): Promise<any> {
    const lockedSeats = await this.checkLockedSeatsInDB(showtimeId, seats);
    const now = new Date();
    
    // Get TTL information from MongoDB
    const showtime = await this.showtimeModel.findById(showtimeId);
    const ttls: { [seat: string]: number } = {};

    if (showtime) {
      for (const seat of seats) {
        const lock = showtime.tempLockedSeats.find(l => l.seat === seat);
        if (lock && lock.expiresAt > now) {
          // Return TTL in seconds
          ttls[seat] = Math.floor((lock.expiresAt.getTime() - now.getTime()) / 1000);
        } else {
          ttls[seat] = -2; // -2 means not locked
        }
      }
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

  /**
   * Verify QR code scanned at cinema
   */
  async verifyQRCode(qrData: string) {
    const result = this.qrcodeService.verifyQRCode(qrData);

    if (!result.valid) {
      return {
        valid: false,
        error: result.error,
      };
    }

    // Check if booking exists and is confirmed
    const booking = await this.bookingModel
      .findById(result.data.bookingId)
      .populate({
        path: 'showtimeId',
        populate: [{ path: 'movieId' }, { path: 'theaterId' }],
      })
      .populate('userId')
      .exec();

    if (!booking) {
      return {
        valid: false,
        error: 'Booking not found',
      };
    }

    if (booking.bookingCode !== result.data.bookingCode) {
      return {
        valid: false,
        error: 'Booking code mismatch',
      };
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      return {
        valid: false,
        error: `Booking status is ${booking.status}, must be confirmed`,
      };
    }

    // Check if showtime has already passed
    const showtime = booking.showtimeId as any;
    if (new Date(showtime.startTime) < new Date()) {
      return {
        valid: false,
        error: 'Showtime has already passed',
      };
    }

    this.logger.log(`QR code verified successfully for booking ${booking.bookingCode}`);

    const user = booking.userId as any;
    return {
      valid: true,
      booking: {
        bookingCode: booking.bookingCode,
        movieTitle: showtime.movieId.title,
        theaterName: showtime.theaterId.name,
        startTime: showtime.startTime,
        seats: booking.seats,
        totalPrice: booking.totalPrice,
        userName: user.fullName,
      },
    };
  }

  /**
   * Generate QR code for existing booking
   */
  async generateBookingQRCode(id: string) {
    const booking = await this.findOne(id);

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Can only generate QR code for confirmed bookings');
    }

    const qrCodeData = {
      bookingId: booking._id.toString(),
      bookingCode: booking.bookingCode,
      userId: booking.userId.toString(),
      showtimeId: booking.showtimeId.toString(),
      seats: booking.seats,
      totalPrice: booking.totalPrice,
      timestamp: Date.now(),
    };

    const qrCodeUrl = await this.qrcodeService.generateQRCodeDataURL(qrCodeData);

    return {
      bookingCode: booking.bookingCode,
      qrCodeUrl,
    };
  }

  // ==================== CRON JOBS ====================

  /**
   * Auto-cancel expired PENDING bookings
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoCancelExpiredBookings() {
    try {
      const expirationTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago

      const expiredBookings = await this.bookingModel.find({
        status: BookingStatus.PENDING,
        createdAt: { $lt: expirationTime },
      });

      if (expiredBookings.length === 0) {
        return;
      }

      this.logger.log(`Found ${expiredBookings.length} expired bookings to cancel`);

      for (const booking of expiredBookings) {
        // Update booking status
        booking.status = BookingStatus.CANCELLED;
        await booking.save();

        // Release locked seats
        await this.showtimeModel.updateOne(
          { _id: booking.showtimeId },
          {
            $pull: {
              bookedSeats: { $in: booking.seats },
              tempLockedSeats: {
                userId: booking.userId.toString(),
                seat: { $in: booking.seats },
              },
            },
          },
        );

        this.logger.log(
          `Auto-cancelled expired booking ${booking.bookingCode} for user ${booking.userId}`,
        );
      }

      this.logger.log(`Auto-cancelled ${expiredBookings.length} expired bookings`);
    } catch (error) {
      this.logger.error('Error auto-cancelling expired bookings:', error.message);
    }
  }

  /**
   * Cleanup old temp seat locks from showtimes
   * Runs every 10 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupExpiredSeatLocks() {
    try {
      const now = new Date();

      const result = await this.showtimeModel.updateMany(
        {},
        {
          $pull: {
            tempLockedSeats: { expiresAt: { $lt: now } },
          },
        },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(
          `Cleaned up expired seat locks from ${result.modifiedCount} showtimes`,
        );
      }
    } catch (error) {
      this.logger.error('Error cleaning up expired seat locks:', error.message);
    }
  }
}
