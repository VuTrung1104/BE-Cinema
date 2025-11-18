import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus, PaymentMethod } from './schemas/payment.schema';
import { BookingsService } from '../bookings/bookings.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockPaymentModel: any;
  let mockBookingsService: any;

  const mockPayment = {
    _id: 'payment123',
    bookingId: 'booking123',
    amount: 100,
    method: PaymentMethod.CREDIT_CARD,
    transactionId: 'TXN-TEST-123',
    status: PaymentStatus.PENDING,
    paidAt: null,
    createdAt: new Date(),
    save: jest.fn().mockResolvedValue(this),
  };

  const mockBooking = {
    _id: 'booking123',
    userId: 'user123',
    showtimeId: 'showtime123',
    seats: ['A1', 'A2'],
    totalPrice: 100,
    status: 'pending',
  };

  beforeEach(async () => {
    mockPaymentModel = {
      new: jest.fn(),
      constructor: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockBookingsService = {
      findOne: jest.fn(),
      confirmBooking: jest.fn(),
      cancelBooking: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getModelToken(Payment.name),
          useValue: mockPaymentModel,
        },
        {
          provide: BookingsService,
          useValue: mockBookingsService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it.skip('should create a new payment successfully', async () => {
      const createPaymentDto = {
        bookingId: 'booking123',
        amount: 100,
        method: PaymentMethod.CREDIT_CARD,
      };

      mockBookingsService.findOne.mockResolvedValue(mockBooking);

      const saveMock = jest.fn().mockResolvedValue(mockPayment);
      
      // Properly mock the model constructor
      jest.spyOn(service as any, 'paymentModel').mockImplementation(() => ({
        save: saveMock,
        ...mockPayment,
      }));

      const result = await service.create(createPaymentDto);

      expect(mockBookingsService.findOne).toHaveBeenCalledWith('booking123');
      expect(result).toHaveProperty('transactionId');
      expect(result.status).toBe(PaymentStatus.PENDING);
    });

    it('should throw BadRequestException if booking is not pending', async () => {
      const createPaymentDto = {
        bookingId: 'booking123',
        amount: 100,
        method: PaymentMethod.CREDIT_CARD,
      };

      mockBookingsService.findOne.mockResolvedValue({
        ...mockBooking,
        status: 'confirmed',
      });

      await expect(service.create(createPaymentDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createPaymentDto)).rejects.toThrow(
        'Booking is not in pending status',
      );
    });
  });

  describe('processPayment', () => {
    it('should process payment and confirm booking successfully', async () => {
      const paymentId = 'payment123';
      const mockPendingPayment = {
        ...mockPayment,
        status: PaymentStatus.PENDING,
        save: jest.fn().mockResolvedValue({
          ...mockPayment,
          status: PaymentStatus.COMPLETED,
          paidAt: expect.any(Date),
        }),
      };

      mockPaymentModel.findById.mockResolvedValue(mockPendingPayment);
      mockBookingsService.confirmBooking.mockResolvedValue(mockBooking);

      const result = await service.processPayment(paymentId);

      expect(mockPaymentModel.findById).toHaveBeenCalledWith(paymentId);
      expect(mockPendingPayment.save).toHaveBeenCalled();
      expect(mockBookingsService.confirmBooking).toHaveBeenCalledWith('booking123');
      expect(mockPendingPayment.status).toBe(PaymentStatus.COMPLETED);
      expect(mockPendingPayment.paidAt).toBeDefined();
    });

    it('should throw NotFoundException if payment does not exist', async () => {
      mockPaymentModel.findById.mockResolvedValue(null);

      await expect(service.processPayment('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.processPayment('nonexistent')).rejects.toThrow(
        'Payment with ID nonexistent not found',
      );
    });

    it('should throw BadRequestException if payment is not pending', async () => {
      const mockCompletedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      };

      mockPaymentModel.findById.mockResolvedValue(mockCompletedPayment);

      await expect(service.processPayment('payment123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.processPayment('payment123')).rejects.toThrow(
        'Payment is not in pending status',
      );
    });
  });

  describe('findAll', () => {
    it('should return all payments without filters', async () => {
      const mockPayments = [mockPayment];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPayments),
      };

      mockPaymentModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll();

      expect(mockPaymentModel.find).toHaveBeenCalledWith({});
      expect(mockQuery.populate).toHaveBeenCalled();
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual(mockPayments);
    });

    it('should filter payments by bookingId', async () => {
      const mockPayments = [mockPayment];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPayments),
      };

      mockPaymentModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll({ bookingId: 'booking123' });

      expect(mockPaymentModel.find).toHaveBeenCalledWith({ bookingId: 'booking123' });
      expect(result).toEqual(mockPayments);
    });

    it('should filter payments by status', async () => {
      const mockPayments = [mockPayment];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPayments),
      };

      mockPaymentModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll({ status: PaymentStatus.COMPLETED });

      expect(mockPaymentModel.find).toHaveBeenCalledWith({ status: PaymentStatus.COMPLETED });
      expect(result).toEqual(mockPayments);
    });

    it('should filter payments by both bookingId and status', async () => {
      const mockPayments = [mockPayment];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPayments),
      };

      mockPaymentModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll({
        bookingId: 'booking123',
        status: PaymentStatus.COMPLETED,
      });

      expect(mockPaymentModel.find).toHaveBeenCalledWith({
        bookingId: 'booking123',
        status: PaymentStatus.COMPLETED,
      });
      expect(result).toEqual(mockPayments);
    });
  });

  describe('findOne', () => {
    it('should return a payment by id', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPayment),
      };

      mockPaymentModel.findById.mockReturnValue(mockQuery);

      const result = await service.findOne('payment123');

      expect(mockPaymentModel.findById).toHaveBeenCalledWith('payment123');
      expect(mockQuery.populate).toHaveBeenCalled();
      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException if payment does not exist', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };

      mockPaymentModel.findById.mockReturnValue(mockQuery);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Payment with ID nonexistent not found',
      );
    });
  });

  describe('refund', () => {
    it('should refund a completed payment successfully', async () => {
      const paymentId = 'payment123';
      const mockCompletedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        save: jest.fn().mockResolvedValue({
          ...mockPayment,
          status: PaymentStatus.REFUNDED,
        }),
      };

      mockPaymentModel.findById.mockResolvedValue(mockCompletedPayment);
      mockBookingsService.cancelBooking.mockResolvedValue(mockBooking);

      const result = await service.refund(paymentId);

      expect(mockPaymentModel.findById).toHaveBeenCalledWith(paymentId);
      expect(mockCompletedPayment.save).toHaveBeenCalled();
      expect(mockBookingsService.cancelBooking).toHaveBeenCalledWith('booking123');
      expect(mockCompletedPayment.status).toBe(PaymentStatus.REFUNDED);
    });

    it('should throw NotFoundException if payment does not exist', async () => {
      mockPaymentModel.findById.mockResolvedValue(null);

      await expect(service.refund('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.refund('nonexistent')).rejects.toThrow(
        'Payment with ID nonexistent not found',
      );
    });

    it('should throw BadRequestException if payment is not completed', async () => {
      const mockPendingPayment = {
        ...mockPayment,
        status: PaymentStatus.PENDING,
      };

      mockPaymentModel.findById.mockResolvedValue(mockPendingPayment);

      await expect(service.refund('payment123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.refund('payment123')).rejects.toThrow(
        'Only completed payments can be refunded',
      );
    });

    it('should not refund an already refunded payment', async () => {
      const mockRefundedPayment = {
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
      };

      mockPaymentModel.findById.mockResolvedValue(mockRefundedPayment);

      await expect(service.refund('payment123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('generateTransactionId', () => {
    it('should generate unique transaction IDs', () => {
      // Access private method through any type assertion
      const txn1 = (service as any).generateTransactionId();
      const txn2 = (service as any).generateTransactionId();

      expect(txn1).toMatch(/^TXN-[A-Z0-9]+-[A-Z0-9]+$/);
      expect(txn2).toMatch(/^TXN-[A-Z0-9]+-[A-Z0-9]+$/);
      expect(txn1).not.toBe(txn2);
    });
  });
});
