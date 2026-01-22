import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Showtime, ShowtimeDocument } from './schemas/showtime.schema';
import { CreateShowtimeDto } from './dto/create-showtime.dto';

@Injectable()
export class ShowtimesService {
  constructor(
    @InjectModel(Showtime.name) private showtimeModel: Model<ShowtimeDocument>,
  ) {}

  async create(createShowtimeDto: CreateShowtimeDto) {
    const showtime = new this.showtimeModel(createShowtimeDto);
    return showtime.save();
  }

  async findAll(filters?: { movieId?: string; theaterId?: string; date?: string }) {
    const query: any = {};
    
    if (filters?.movieId) {
      query.movieId = filters.movieId;
    }
    
    if (filters?.theaterId) {
      query.theaterId = filters.theaterId;
    }
    
    if (filters?.date) {
      // Parse date as UTC to match database dates
      // Input: "2026-01-15" -> Parse as start of day in UTC
      const startDate = new Date(filters.date + 'T00:00:00.000Z');
      const endDate = new Date(filters.date + 'T23:59:59.999Z');
      
      query.startTime = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const results = await this.showtimeModel
      .find(query)
      .populate('movieId')
      .populate('theaterId')
      .exec();
    return results;
  }

  async findOne(id: string) {
    const showtime = await this.showtimeModel
      .findById(id)
      .populate('movieId')
      .populate('theaterId')
      .exec();
    
    if (!showtime) {
      throw new NotFoundException(`Showtime with ID ${id} not found`);
    }
    
    return showtime;
  }

  async getAvailableSeats(id: string) {
    const showtime = await this.findOne(id);
    
    // Clean up expired temp locks
    const now = new Date();
    showtime.tempLockedSeats = showtime.tempLockedSeats.filter(
      (lock) => lock.expiresAt > now
    );
    await showtime.save();
    
    const totalSeats = showtime.totalSeats || 80;
    const bookedCount = showtime.bookedSeats?.length || 0;
    const lockedSeats = showtime.tempLockedSeats.map(lock => lock.seat);
    
    return {
      showtimeId: id,
      bookedSeats: showtime.bookedSeats || [],
      lockedSeats: lockedSeats,
      availableSeats: totalSeats - bookedCount - lockedSeats.length,
      totalSeats: totalSeats,
      rows: showtime.rows || 8,
      seatsPerRow: showtime.seatsPerRow || 10,
      lastUpdate: new Date().toISOString(),
    };
  }

  async bookSeats(id: string, seats: string[]) {
    const showtime = await this.findOne(id);
    
    // Check if any seats are already booked
    const alreadyBooked = seats.filter(seat => showtime.bookedSeats.includes(seat));
    
    if (alreadyBooked.length > 0) {
      throw new BadRequestException(`Seats ${alreadyBooked.join(', ')} are already booked`);
    }
    
    // Add seats to booked list
    showtime.bookedSeats.push(...seats);
    return showtime.save();
  }

  async releaseSeats(id: string, seats: string[]) {
    const showtime = await this.findOne(id);
    
    // Remove seats from booked list
    showtime.bookedSeats = showtime.bookedSeats.filter(
      seat => !seats.includes(seat)
    );
    
    return showtime.save();
  }

  async remove(id: string) {
    const result = await this.showtimeModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Showtime with ID ${id} not found`);
    }
    return { message: 'Showtime deleted successfully' };
  }
}
