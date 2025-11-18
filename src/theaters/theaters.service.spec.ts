import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { TheatersService } from './theaters.service';
import { Theater } from './schemas/theater.schema';

describe('TheatersService', () => {
  let service: TheatersService;
  let mockTheaterModel: any;

  const mockTheater = {
    _id: 'theater123',
    name: 'CGV Vincom',
    address: 'District 1, Ho Chi Minh City',
    city: 'Ho Chi Minh City',
    totalSeats: 200,
    rows: [10, 10, 10, 10, 10, 10, 10, 10],
  };

  beforeEach(async () => {
    mockTheaterModel = {
      new: jest.fn(),
      constructor: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TheatersService,
        {
          provide: getModelToken(Theater.name),
          useValue: mockTheaterModel,
        },
      ],
    }).compile();

    service = module.get<TheatersService>(TheatersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it.skip('should create a new theater successfully', async () => {
      const createTheaterDto = {
        name: 'CGV Vincom',
        address: 'District 1, Ho Chi Minh City',
        city: 'Ho Chi Minh City',
        totalSeats: 200,
        rows: [10, 10, 10, 10, 10, 10, 10, 10],
      };

      const saveMock = jest.fn().mockResolvedValue(mockTheater);
      
      // Properly mock the model constructor
      jest.spyOn(service as any, 'theaterModel').mockImplementation(() => ({
        save: saveMock,
        ...mockTheater,
      }));

      const result = await service.create(createTheaterDto);

      expect(result).toHaveProperty('name', 'CGV Vincom');
      expect(result).toHaveProperty('city', 'Ho Chi Minh City');
    });
  });

  describe('findAll', () => {
    it('should return all theaters without filter', async () => {
      const mockTheaters = [mockTheater];
      const mockExec = jest.fn().mockResolvedValue(mockTheaters);
      mockTheaterModel.find.mockReturnValue({ exec: mockExec });

      const result = await service.findAll();

      expect(mockTheaterModel.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockTheaters);
    });

    it('should filter theaters by city', async () => {
      const mockTheaters = [mockTheater];
      const mockExec = jest.fn().mockResolvedValue(mockTheaters);
      mockTheaterModel.find.mockReturnValue({ exec: mockExec });

      const result = await service.findAll('Ho Chi Minh City');

      expect(mockTheaterModel.find).toHaveBeenCalledWith({ city: 'Ho Chi Minh City' });
      expect(result).toEqual(mockTheaters);
    });

    it('should return empty array when no theaters found', async () => {
      const mockExec = jest.fn().mockResolvedValue([]);
      mockTheaterModel.find.mockReturnValue({ exec: mockExec });

      const result = await service.findAll('Unknown City');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a theater by id', async () => {
      const mockExec = jest.fn().mockResolvedValue(mockTheater);
      mockTheaterModel.findById.mockReturnValue({ exec: mockExec });

      const result = await service.findOne('theater123');

      expect(mockTheaterModel.findById).toHaveBeenCalledWith('theater123');
      expect(result).toEqual(mockTheater);
    });

    it('should throw NotFoundException if theater does not exist', async () => {
      const mockExec = jest.fn().mockResolvedValue(null);
      mockTheaterModel.findById.mockReturnValue({ exec: mockExec });

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Theater with ID nonexistent not found',
      );
    });
  });

  describe('update', () => {
    it('should update a theater successfully', async () => {
      const updateTheaterDto = {
        name: 'CGV Vincom Center',
        capacity: 250,
      };

      const updatedTheater = {
        ...mockTheater,
        ...updateTheaterDto,
      };

      const mockExec = jest.fn().mockResolvedValue(updatedTheater);
      mockTheaterModel.findByIdAndUpdate.mockReturnValue({ exec: mockExec });

      const result = await service.update('theater123', updateTheaterDto);

      expect(mockTheaterModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'theater123',
        updateTheaterDto,
        { new: true },
      );
      expect(result).toEqual(updatedTheater);
      expect(result.name).toBe('CGV Vincom Center');
    });

    it('should throw NotFoundException if theater does not exist', async () => {
      const updateTheaterDto = {
        name: 'CGV Vincom Center',
      };

      const mockExec = jest.fn().mockResolvedValue(null);
      mockTheaterModel.findByIdAndUpdate.mockReturnValue({ exec: mockExec });

      await expect(
        service.update('nonexistent', updateTheaterDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update('nonexistent', updateTheaterDto),
      ).rejects.toThrow('Theater with ID nonexistent not found');
    });

    it('should partially update theater fields', async () => {
      const updateTheaterDto = {
        totalSeats: 300,
      };

      const updatedTheater = {
        ...mockTheater,
        totalSeats: 300,
      };

      const mockExec = jest.fn().mockResolvedValue(updatedTheater);
      mockTheaterModel.findByIdAndUpdate.mockReturnValue({ exec: mockExec });

      const result = await service.update('theater123', updateTheaterDto);

      expect(result.totalSeats).toBe(300);
      expect(result.name).toBe(mockTheater.name);
    });
  });

  describe('remove', () => {
    it('should delete a theater successfully', async () => {
      const mockExec = jest.fn().mockResolvedValue(mockTheater);
      mockTheaterModel.findByIdAndDelete.mockReturnValue({ exec: mockExec });

      const result = await service.remove('theater123');

      expect(mockTheaterModel.findByIdAndDelete).toHaveBeenCalledWith('theater123');
      expect(result).toEqual({ message: 'Theater deleted successfully' });
    });

    it('should throw NotFoundException if theater does not exist', async () => {
      const mockExec = jest.fn().mockResolvedValue(null);
      mockTheaterModel.findByIdAndDelete.mockReturnValue({ exec: mockExec });

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove('nonexistent')).rejects.toThrow(
        'Theater with ID nonexistent not found',
      );
    });
  });
});
