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

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  async create(createMovieDto: CreateMovieDto) {
    const slug = this.generateSlug(createMovieDto.title);
    const movie = new this.movieModel({ ...createMovieDto, slug });
    return movie.save();
  }

  async findAll(
    filters?: { genre?: string; status?: string; isNowShowing?: boolean; search?: string },
    paginationDto?: PaginationDto,
  ) {
    const query: any = {};
    
    if (filters?.genre) {
      query.genres = filters.genre;
    }
    
    // Ưu tiên sử dụng status nếu có
    if (filters?.status) {
      query.status = filters.status;
    } else if (filters?.isNowShowing !== undefined) {
      // Backward compatibility với isNowShowing
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

  async findBySlug(slug: string) {
    const movie = await this.movieModel.findOne({ slug }).exec();
    if (!movie) {
      throw new NotFoundException(`Movie with slug "${slug}" not found`);
    }
    return movie;
  }

  async update(id: string, updateMovieDto: Partial<CreateMovieDto>) {
    const updateData: any = { ...updateMovieDto };
    
    // Regenerate slug if title is updated
    if (updateMovieDto.title) {
      updateData.slug = this.generateSlug(updateMovieDto.title);
    }
    
    const movie = await this.movieModel
      .findByIdAndUpdate(id, updateData, { new: true })
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
