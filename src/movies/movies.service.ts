import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Movie, MovieDocument } from './schemas/movie.schema';
import { CreateMovieDto } from './dto/create-movie.dto';
import { PaginationDto, createPaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class MoviesService {
  constructor(
    @InjectModel(Movie.name) private movieModel: Model<MovieDocument>,
  ) {}

  async create(createMovieDto: CreateMovieDto) {
    const movie = new this.movieModel(createMovieDto);
    return movie.save();
  }

  async findAll(
    filters?: { genre?: string; isNowShowing?: boolean; search?: string },
    paginationDto?: PaginationDto,
  ) {
    const query: any = {};
    
    if (filters?.genre) {
      query.genres = filters.genre;
    }
    
    if (filters?.isNowShowing !== undefined) {
      query.isNowShowing = filters.isNowShowing;
    }

    // Add search functionality
    if (filters?.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { director: { $regex: filters.search, $options: 'i' } },
      ];
    }

    // If no pagination, return all results
    if (!paginationDto) {
      return this.movieModel.find(query).sort({ releaseDate: -1 }).exec();
    }

    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.movieModel.find(query).sort({ releaseDate: -1 }).skip(skip).limit(limit).exec(),
      this.movieModel.countDocuments(query).exec(),
    ]);

    return createPaginatedResult(data, total, page, limit);
  }

  async findOne(id: string) {
    const movie = await this.movieModel.findById(id).exec();
    if (!movie) {
      throw new NotFoundException(`Movie with ID ${id} not found`);
    }
    return movie;
  }

  async update(id: string, updateMovieDto: Partial<CreateMovieDto>) {
    const movie = await this.movieModel
      .findByIdAndUpdate(id, updateMovieDto, { new: true })
      .exec();
    
    if (!movie) {
      throw new NotFoundException(`Movie with ID ${id} not found`);
    }
    
    return movie;
  }

  async remove(id: string) {
    const result = await this.movieModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Movie with ID ${id} not found`);
    }
    return { message: 'Movie deleted successfully' };
  }
}
