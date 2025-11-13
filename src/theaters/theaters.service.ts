import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Theater, TheaterDocument } from './schemas/theater.schema';
import { CreateTheaterDto } from './dto/create-theater.dto';

@Injectable()
export class TheatersService {
  constructor(
    @InjectModel(Theater.name) private theaterModel: Model<TheaterDocument>,
  ) {}

  async create(createTheaterDto: CreateTheaterDto) {
    const theater = new this.theaterModel(createTheaterDto);
    return theater.save();
  }

  async findAll(city?: string) {
    const query = city ? { city } : {};
    return this.theaterModel.find(query).exec();
  }

  async findOne(id: string) {
    const theater = await this.theaterModel.findById(id).exec();
    if (!theater) {
      throw new NotFoundException(`Theater with ID ${id} not found`);
    }
    return theater;
  }

  async update(id: string, updateTheaterDto: Partial<CreateTheaterDto>) {
    const theater = await this.theaterModel
      .findByIdAndUpdate(id, updateTheaterDto, { new: true })
      .exec();
    
    if (!theater) {
      throw new NotFoundException(`Theater with ID ${id} not found`);
    }
    
    return theater;
  }

  async remove(id: string) {
    const result = await this.theaterModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Theater with ID ${id} not found`);
    }
    return { message: 'Theater deleted successfully' };
  }
}
