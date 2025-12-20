import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { Booking, BookingDocument, BookingStatus } from './schemas/booking.schema';
import { Showtime, ShowtimeDocument } from '../showtimes/schemas/showtime.schema';
import { ShowtimesService } from '../showtimes/showtimes.service';
import { QRCodeService } from '../common/services/qrcode.service';
import { EmailService } from '../common/services/email.service';
import { CreateBookingDto } from './dto/create-booking.dto';

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingModel: Model<BookingDocument>;
  let showtimeModel: Model<ShowtimeDocument>;
  let showtimesService: ShowtimesService;
  let qrcodeService: QRCodeService;
  let emailService: EmailService;
  let connection: Connection;

  const mockShowtime = {
    _id: 'showtime123',
    movieId: 'movie123',
    theaterId: 'theater123',
    startTime: new Date('2024-12-25T19:00:00'),
    endTime: new Date('2024-12-25T21:00:00'),
    price: 100000,
    bookedSeats: ['A1', 'A2'],
    totalSeats: 100,
  };

  const mockBooking = {
    _id: 'booking123',
    userId: 'user123',
    showtimeId: 'showtime123',
    seats: ['B1', 'B2'],
    totalPrice: 200000,
    bookingCode: 'BK123456',
    status: BookingStatus.PENDING,
    save: jest.fn().mockResolvedValue(this),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(this),
  };

  const mockBookingModel = function(dto: any) {
    return {
      ...mockBooking,
      ...dto,
      save: jest.fn().mockResolvedValue({ ...mockBooking, ...dto }),
    };
  } as any;
  
  mockBookingModel.find = jest.fn();
  mockBookingModel.findById = jest.fn();
  mockBookingModel.findOne = jest.fn();
  mockBookingModel.findByIdAndUpdate = jest.fn();

  const mockShowtimeModel = {
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    findById: jest.fn().mockResolvedValue({
      _id: 'showtime123',
      tempLockedSeats: [],
      bookedSeats: ['A1', 'A2'],
    }),
  } as any;

  const mockShowtimesService = {
    findOne: jest.fn(),
    bookSeats: jest.fn(),
    releaseSeats: jest.fn(),
  };

  const mockQRCodeService = {
    generateBookingQRCode: jest.fn().mockResolvedValue('data:image/png;base64,mockqrcode'),
  };

  const mockEmailService = {
    sendBookingConfirmation: jest.fn().mockResolvedValue(true),
  };

  const mockConnection = {
    startSession: jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: getModelToken(Booking.name),
          useValue: mockBookingModel,
        },
        {
          provide: getModelToken(Showtime.name),
          useValue: mockShowtimeModel,
        },
        {
          provide: ShowtimesService,
          useValue: mockShowtimesService,
        },
        {
          provide: QRCodeService,
          useValue: mockQRCodeService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    bookingModel = module.get<Model<BookingDocument>>(getModelToken(Booking.name));
    showtimeModel = module.get<Model<ShowtimeDocument>>(getModelToken(Showtime.name));
    showtimesService = module.get<ShowtimesService>(ShowtimesService);
    qrcodeService = module.get<QRCodeService>(QRCodeService);
    emailService = module.get<EmailService>(EmailService);
    connection = module.get<Connection>(getConnectionToken());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a booking with available seats', async () => {
      const createBookingDto: CreateBookingDto = {
        showtimeId: '507f1f77bcf86cd799439011',
        seats: ['B1', 'B2'],
      };

      // Mock showtime model to return success for locking
      mockShowtimeModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
      mockShowtimeModel.findById.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        tempLockedSeats: [],
        bookedSeats: ['A1', 'A2'],
      });

      mockShowtimesService.findOne.mockResolvedValue(mockShowtime);
      mockShowtimesService.bookSeats.mockResolvedValue(true);

      const result = await service.create('507f191e810c19729de860ea', createBookingDto);

      expect(result).toBeDefined();
      expect(mockShowtimesService.findOne).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockShowtimesService.bookSeats).toHaveBeenCalledWith('507f1f77bcf86cd799439011', ['B1', 'B2']);
    });

    it('should throw ConflictException if seats cannot be locked', async () => {
      const createBookingDto: CreateBookingDto = {
        showtimeId: '507f1f77bcf86cd799439011',
        seats: ['A1', 'B1'], // A1 is already booked
      };

      // Mock lock failure
      mockShowtimeModel.updateOne.mockResolvedValue({ modifiedCount: 0 });

      await expect(service.create('507f191e810c19729de860ea', createBookingDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should calculate correct total price', async () => {
      const createBookingDto: CreateBookingDto = {
        showtimeId: '507f1f77bcf86cd799439011',
        seats: ['B1', 'B2', 'B3'],
      };

      mockShowtimeModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
      mockShowtimeModel.findById.mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        tempLockedSeats: [],
        bookedSeats: ['A1', 'A2'],
      });

      mockShowtimesService.findOne.mockResolvedValue(mockShowtime);
      mockShowtimesService.bookSeats.mockResolvedValue(true);

      const result = await service.create('507f191e810c19729de860ea', createBookingDto);

      expect(result).toBeDefined();
      expect(result.seats).toEqual(createBookingDto.seats);
    });
  });

  describe('findAll', () => {
    it('should return all bookings for a user', async () => {
      const bookings = [mockBooking];

      mockBookingModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(bookings),
          }),
        }),
      });

      const result = await service.findAll('user123');

      expect(result).toEqual(bookings);
      expect(mockBookingModel.find).toHaveBeenCalledWith({ userId: 'user123' });
    });

    it('should return all bookings when no userId provided', async () => {
      const bookings = [mockBooking, { ...mockBooking, _id: 'booking456' }];

      mockBookingModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(bookings),
          }),
        }),
      });

      const result = await service.findAll();

      expect(result).toEqual(bookings);
      expect(mockBookingModel.find).toHaveBeenCalledWith({});
    });
  });

  describe('findOne', () => {
    it('should return a booking by id', async () => {
      mockBookingModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockBooking),
        }),
      });

      const result = await service.findOne('booking123');

      expect(result).toEqual(mockBooking);
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockBookingModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.findOne('invalidId')).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmBooking', () => {
    it('should confirm a pending booking', async () => {
      const pendingBooking = { 
        ...mockBooking, 
        status: BookingStatus.PENDING,
        save: jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED }),
        populate: jest.fn().mockReturnThis(),
      };

      mockBookingModel.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(pendingBooking),
      });

      const result = await service.confirmBooking('booking123');

      expect(result.status).toBe(BookingStatus.CONFIRMED);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a booking and release seats', async () => {
      const bookingToCancel = {
        ...mockBooking,
        status: BookingStatus.PENDING,
        showtimeId: '507f1f77bcf86cd799439011',
        userId: '507f191e810c19729de860ea',
        seats: ['B1', 'B2'],
        save: jest.fn().mockResolvedValue({ 
          ...mockBooking, 
          status: BookingStatus.CANCELLED,
          showtimeId: '507f1f77bcf86cd799439011',
          seats: ['B1', 'B2']
        })
      };

      mockBookingModel.findById.mockResolvedValue(bookingToCancel);
      mockShowtimesService.releaseSeats.mockResolvedValue(true);
      mockShowtimeModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.cancelBooking('booking123');

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(mockShowtimesService.releaseSeats).toHaveBeenCalledWith('showtime123', ['B1', 'B2']);
    });

    it('should throw BadRequestException if booking already cancelled', async () => {
      const cancelledBooking = { ...mockBooking, status: BookingStatus.CANCELLED };

      mockBookingModel.findById.mockResolvedValue(cancelledBooking);

      await expect(service.cancelBooking('booking123')).rejects.toThrow(BadRequestException);
    });
  });
});
