import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { Booking, BookingDocument, BookingStatus } from './schemas/booking.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ShowtimesService } from '../showtimes/showtimes.service';
import { RedisService } from '../redis/redis.service';
import { QRCodeService } from '../common/services/qrcode.service';
import { EmailService } from '../common/services/email.service';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectConnection() private connection: Connection,
    private showtimesService: ShowtimesService,
    private redisService: RedisService,
    private qrcodeService: QRCodeService,
    private emailService: EmailService,
  ) {}

  async create(userId: string, createBookingDto: CreateBookingDto) {
    const { showtimeId, seats } = createBookingDto;

    // Start a database transaction for atomicity
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Step 1: Try to lock seats in Redis (prevents race conditions)
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

      // Step 3: Check if seats are available in database (double-check)
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
      
      // Release Redis locks on failure
      try {
        await this.redisService.unlockSeats(showtimeId, seats, userId);
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

    // Release Redis locks when booking is confirmed (payment completed)
    await this.redisService.unlockSeats(
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
}
