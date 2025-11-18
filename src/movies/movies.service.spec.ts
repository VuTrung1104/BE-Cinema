import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { Movie, MovieDocument, MovieGenre } from './schemas/movie.schema';
import { CreateMovieDto } from './dto/create-movie.dto';

describe('MoviesService', () => {
  let service: MoviesService;
  let movieModel: Model<MovieDocument>;

  const mockMovie = {
    _id: 'movie123',
    title: 'Test Movie',
    description: 'A test movie',
    genres: [MovieGenre.ACTION, MovieGenre.DRAMA],
    duration: 120,
    releaseDate: new Date('2024-01-01'),
    director: 'Test Director',
    cast: ['Actor 1', 'Actor 2'],
    rating: 8.5,
    isNowShowing: true,
    save: jest.fn().mockResolvedValue(this),
  };

  const mockMovieModel = function(dto: any) {
    return {
      ...mockMovie,
      ...dto,
      save: jest.fn().mockResolvedValue({ ...mockMovie, ...dto }),
    };
  } as any;

  mockMovieModel.find = jest.fn();
  mockMovieModel.findById = jest.fn();
  mockMovieModel.findByIdAndUpdate = jest.fn();
  mockMovieModel.findByIdAndDelete = jest.fn();
  mockMovieModel.create = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoviesService,
        {
          provide: getModelToken(Movie.name),
          useValue: mockMovieModel,
        },
      ],
    }).compile();

    service = module.get<MoviesService>(MoviesService);
    movieModel = module.get<Model<MovieDocument>>(getModelToken(Movie.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and return a new movie', async () => {
      const createMovieDto: CreateMovieDto = {
        title: 'New Movie',
        description: 'A new test movie',
        genres: [MovieGenre.ACTION],
        duration: 90,
        releaseDate: new Date('2024-06-01'),
      };

      const result = await service.create(createMovieDto);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('title');
    });
  });

  describe('findAll', () => {
    it('should return all movies without filters', async () => {
      const movies = [mockMovie, { ...mockMovie, _id: 'movie456', title: 'Another Movie' }];
      
      mockMovieModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(movies),
      });

      const result = await service.findAll();

      expect(result).toEqual(movies);
      expect(mockMovieModel.find).toHaveBeenCalledWith({});
    });

    it('should return movies filtered by genre', async () => {
      const movies = [mockMovie];
      
      mockMovieModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(movies),
      });

      const result = await service.findAll({ genre: 'action' });

      expect(result).toEqual(movies);
      expect(mockMovieModel.find).toHaveBeenCalledWith({ genres: 'action' });
    });

    it('should return movies filtered by isNowShowing', async () => {
      const movies = [mockMovie];
      
      mockMovieModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(movies),
      });

      const result = await service.findAll({ isNowShowing: true });

      expect(result).toEqual(movies);
      expect(mockMovieModel.find).toHaveBeenCalledWith({ isNowShowing: true });
    });
  });

  describe('findOne', () => {
    it('should return a movie by id', async () => {
      mockMovieModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockMovie),
      });

      const result = await service.findOne('movie123');

      expect(result).toEqual(mockMovie);
      expect(mockMovieModel.findById).toHaveBeenCalledWith('movie123');
    });

    it('should throw NotFoundException if movie not found', async () => {
      mockMovieModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne('invalidId')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return the movie', async () => {
      const updateDto = { title: 'Updated Movie' };
      const updatedMovie = { ...mockMovie, ...updateDto };

      mockMovieModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedMovie),
      });

      const result = await service.update('movie123', updateDto);

      expect(result).toEqual(updatedMovie);
      expect(mockMovieModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'movie123',
        updateDto,
        { new: true },
      );
    });

    it('should throw NotFoundException if movie not found', async () => {
      mockMovieModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.update('invalidId', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a movie and return success message', async () => {
      mockMovieModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockMovie),
      });

      const result = await service.remove('movie123');

      expect(result).toEqual({ message: 'Movie deleted successfully' });
      expect(mockMovieModel.findByIdAndDelete).toHaveBeenCalledWith('movie123');
    });

    it('should throw NotFoundException if movie not found', async () => {
      mockMovieModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('invalidId')).rejects.toThrow(NotFoundException);
    });
  });
});
