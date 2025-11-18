import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShowtimesService } from './showtimes.service';
import { Showtime } from './schemas/showtime.schema';

describe('ShowtimesService', () => {
  let service: ShowtimesService;
  let mockShowtimeModel: any;

  const mockShowtime = {
    _id: 'showtime123',
    movieId: 'movie123',
    theaterId: 'theater123',
    startTime: new Date('2025-01-15T18:00:00Z'),
    endTime: new Date('2025-01-15T20:30:00Z'),
    price: 50,
    bookedSeats: ['A1', 'A2'],
    save: jest.fn().mockResolvedValue(this),
  };

  beforeEach(async () => {
    mockShowtimeModel = {
      new: jest.fn(),
      constructor: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndDelete: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShowtimesService,
        {
          provide: getModelToken(Showtime.name),
          useValue: mockShowtimeModel,
        },
      ],
    }).compile();

    service = module.get<ShowtimesService>(ShowtimesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it.skip('should create a new showtime successfully', async () => {
      const createShowtimeDto = {
        movieId: 'movie123',
        theaterId: 'theater123',
        startTime: new Date('2025-01-15T18:00:00Z'),
        endTime: new Date('2025-01-15T20:30:00Z'),
        price: 50,
      };

      const saveMock = jest.fn().mockResolvedValue(mockShowtime);
      
      // Properly mock the model constructor
      jest.spyOn(service as any, 'showtimeModel').mockImplementation(() => ({
        save: saveMock,
        ...mockShowtime,
      }));

      const result = await service.create(createShowtimeDto);

      expect(result).toHaveProperty('movieId', 'movie123');
      expect(result).toHaveProperty('theaterId', 'theater123');
    });
  });

  describe('findAll', () => {
    it('should return all showtimes without filters', async () => {
      const mockShowtimes = [mockShowtime];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockShowtimes),
      };

      mockShowtimeModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll();

      expect(mockShowtimeModel.find).toHaveBeenCalledWith({});
      expect(mockQuery.populate).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockShowtimes);
    });

    it('should filter showtimes by movieId', async () => {
      const mockShowtimes = [mockShowtime];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockShowtimes),
      };

      mockShowtimeModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll({ movieId: 'movie123' });

      expect(mockShowtimeModel.find).toHaveBeenCalledWith({ movieId: 'movie123' });
      expect(result).toEqual(mockShowtimes);
    });

    it('should filter showtimes by theaterId', async () => {
      const mockShowtimes = [mockShowtime];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockShowtimes),
      };

      mockShowtimeModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll({ theaterId: 'theater123' });

      expect(mockShowtimeModel.find).toHaveBeenCalledWith({ theaterId: 'theater123' });
      expect(result).toEqual(mockShowtimes);
    });

    it('should filter showtimes by date', async () => {
      const mockShowtimes = [mockShowtime];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockShowtimes),
      };

      mockShowtimeModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll({ date: '2025-01-15' });

      expect(mockShowtimeModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: expect.objectContaining({
            $gte: expect.any(Date),
            $lt: expect.any(Date),
          }),
        }),
      );
      expect(result).toEqual(mockShowtimes);
    });

    it('should filter showtimes by multiple filters', async () => {
      const mockShowtimes = [mockShowtime];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockShowtimes),
      };

      mockShowtimeModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll({
        movieId: 'movie123',
        theaterId: 'theater123',
        date: '2025-01-15',
      });

      expect(mockShowtimeModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          movieId: 'movie123',
          theaterId: 'theater123',
          startTime: expect.any(Object),
        }),
      );
      expect(result).toEqual(mockShowtimes);
    });
  });

  describe('findOne', () => {
    it('should return a showtime by id', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockShowtime),
      };

      mockShowtimeModel.findById.mockReturnValue(mockQuery);

      const result = await service.findOne('showtime123');

      expect(mockShowtimeModel.findById).toHaveBeenCalledWith('showtime123');
      expect(mockQuery.populate).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockShowtime);
    });

    it('should throw NotFoundException if showtime does not exist', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockShowtimeModel.findById.mockReturnValue(mockQuery);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Showtime with ID nonexistent not found',
      );
    });
  });

  describe('getAvailableSeats', () => {
    it('should return available seats information', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockShowtime),
      };

      mockShowtimeModel.findById.mockReturnValue(mockQuery);

      const result = await service.getAvailableSeats('showtime123');

      expect(result).toEqual({
        showtimeId: 'showtime123',
        bookedSeats: ['A1', 'A2'],
        availableSeats: 2,
      });
    });

    it('should throw NotFoundException if showtime does not exist', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockShowtimeModel.findById.mockReturnValue(mockQuery);

      await expect(service.getAvailableSeats('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('bookSeats', () => {
    it('should book available seats successfully', async () => {
      const showtimeWithSeats = {
        ...mockShowtime,
        bookedSeats: ['A1', 'A2'],
        save: jest.fn().mockResolvedValue({
          ...mockShowtime,
          bookedSeats: ['A1', 'A2', 'B1', 'B2'],
        }),
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(showtimeWithSeats),
      };

      mockShowtimeModel.findById.mockReturnValue(mockQuery);

      const result = await service.bookSeats('showtime123', ['B1', 'B2']);

      expect(showtimeWithSeats.save).toHaveBeenCalled();
      expect(showtimeWithSeats.bookedSeats).toContain('B1');
      expect(showtimeWithSeats.bookedSeats).toContain('B2');
    });

    it('should throw BadRequestException if seats are already booked', async () => {
      const showtimeWithSeats = {
        ...mockShowtime,
        bookedSeats: ['A1', 'A2'],
        save: jest.fn(),
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(showtimeWithSeats),
      };

      mockShowtimeModel.findById.mockReturnValue(mockQuery);

      await expect(
        service.bookSeats('showtime123', ['A1', 'B1']),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.bookSeats('showtime123', ['A1', 'B1']),
      ).rejects.toThrow('Seats A1 are already booked');
    });

    it('should throw BadRequestException if multiple seats are already booked', async () => {
      const showtimeWithSeats = {
        ...mockShowtime,
        bookedSeats: ['A1', 'A2'],
        save: jest.fn(),
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(showtimeWithSeats),
      };

      mockShowtimeModel.findById.mockReturnValue(mockQuery);

      await expect(
        service.bookSeats('showtime123', ['A1', 'A2', 'B1']),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.bookSeats('showtime123', ['A1', 'A2', 'B1']),
      ).rejects.toThrow('Seats A1, A2 are already booked');
    });

    it('should throw NotFoundException if showtime does not exist', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockShowtimeModel.findById.mockReturnValue(mockQuery);

      await expect(
        service.bookSeats('nonexistent', ['A1']),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('releaseSeats', () => {
    it('should release booked seats successfully', async () => {
      const showtimeWithSeats = {
        ...mockShowtime,
        bookedSeats: ['A1', 'A2', 'B1', 'B2'],
        save: jest.fn().mockResolvedValue({
          ...mockShowtime,
          bookedSeats: ['A1', 'A2'],
        }),
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(showtimeWithSeats),
      };

      mockShowtimeModel.findById.mockReturnValue(mockQuery);

      await service.releaseSeats('showtime123', ['B1', 'B2']);

      expect(showtimeWithSeats.save).toHaveBeenCalled();
      expect(showtimeWithSeats.bookedSeats).not.toContain('B1');
      expect(showtimeWithSeats.bookedSeats).not.toContain('B2');
      expect(showtimeWithSeats.bookedSeats).toContain('A1');
      expect(showtimeWithSeats.bookedSeats).toContain('A2');
    });

    it('should handle releasing seats that are not booked', async () => {
      const showtimeWithSeats = {
        ...mockShowtime,
        bookedSeats: ['A1', 'A2'],
        save: jest.fn().mockResolvedValue({
          ...mockShowtime,
          bookedSeats: ['A1', 'A2'],
        }),
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(showtimeWithSeats),
      };

      mockShowtimeModel.findById.mockReturnValue(mockQuery);

      await service.releaseSeats('showtime123', ['C1', 'C2']);

      expect(showtimeWithSeats.save).toHaveBeenCalled();
      expect(showtimeWithSeats.bookedSeats).toEqual(['A1', 'A2']);
    });

    it('should throw NotFoundException if showtime does not exist', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockShowtimeModel.findById.mockReturnValue(mockQuery);

      await expect(
        service.releaseSeats('nonexistent', ['A1']),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a showtime successfully', async () => {
      const mockExec = jest.fn().mockResolvedValue(mockShowtime);
      mockShowtimeModel.findByIdAndDelete.mockReturnValue({ exec: mockExec });

      const result = await service.remove('showtime123');

      expect(mockShowtimeModel.findByIdAndDelete).toHaveBeenCalledWith('showtime123');
      expect(result).toEqual({ message: 'Showtime deleted successfully' });
    });

    it('should throw NotFoundException if showtime does not exist', async () => {
      const mockExec = jest.fn().mockResolvedValue(null);
      mockShowtimeModel.findByIdAndDelete.mockReturnValue({ exec: mockExec });

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove('nonexistent')).rejects.toThrow(
        'Showtime with ID nonexistent not found',
      );
    });
  });
});
