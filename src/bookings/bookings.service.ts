import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument, BookingStatus } from './schemas/booking.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ShowtimesService } from '../showtimes/showtimes.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    private showtimesService: ShowtimesService,
  ) {}

  async create(userId: string, createBookingDto: CreateBookingDto) {
    const { showtimeId, seats } = createBookingDto;

    // Get showtime details
    const showtime = await this.showtimesService.findOne(showtimeId);

    // Check if seats are available
    const unavailableSeats = seats.filter(seat => 
      showtime.bookedSeats.includes(seat)
    );

    if (unavailableSeats.length > 0) {
      throw new BadRequestException(
        `Seats ${unavailableSeats.join(', ')} are not available`
      );
    }

    // Calculate total price
    const totalPrice = seats.length * showtime.price;

    // Generate unique booking code
    const bookingCode = this.generateBookingCode();

    // Create booking
    const booking = new this.bookingModel({
      userId,
      showtimeId,
      seats,
      totalPrice,
      bookingCode,
      status: BookingStatus.PENDING,
    });

    await booking.save();

    // Book seats in showtime
    await this.showtimesService.bookSeats(showtimeId, seats);

    return booking;
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
    return booking.save();
  }

  async cancelBooking(id: string) {
    const booking = await this.bookingModel.findById(id);
    
    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    booking.status = BookingStatus.CANCELLED;
    return booking.save();
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
