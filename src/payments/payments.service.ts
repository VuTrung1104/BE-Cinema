import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument, PaymentStatus } from './schemas/payment.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private bookingsService: BookingsService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto) {
    const { bookingId, amount, method } = createPaymentDto;

    // Verify booking exists
    const booking = await this.bookingsService.findOne(bookingId);

    if (booking.status !== 'pending') {
      throw new BadRequestException('Booking is not in pending status');
    }

    // Generate transaction ID
    const transactionId = this.generateTransactionId();

    // Create payment
    const payment = new this.paymentModel({
      bookingId,
      amount,
      method,
      transactionId,
      status: PaymentStatus.PENDING,
    });

    await payment.save();

    return payment;
  }

  async processPayment(id: string) {
    const payment = await this.paymentModel.findById(id);

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment is not in pending status');
    }

    // Simulate payment processing
    // In real application, you would integrate with payment gateway here
    payment.status = PaymentStatus.COMPLETED;
    payment.paidAt = new Date();
    await payment.save();

    // Confirm the booking
    await this.bookingsService.confirmBooking(payment.bookingId.toString());

    return payment;
  }

  async findAll(filters?: { bookingId?: string; status?: PaymentStatus }) {
    const query: any = {};

    if (filters?.bookingId) {
      query.bookingId = filters.bookingId;
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    return this.paymentModel
      .find(query)
      .populate({
        path: 'bookingId',
        populate: {
          path: 'showtimeId',
          populate: [
            { path: 'movieId' },
            { path: 'theaterId' }
          ]
        }
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string) {
    const payment = await this.paymentModel
      .findById(id)
      .populate({
        path: 'bookingId',
        populate: {
          path: 'showtimeId',
          populate: [
            { path: 'movieId' },
            { path: 'theaterId' }
          ]
        }
      })
      .exec();

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async refund(id: string) {
    const payment = await this.paymentModel.findById(id);

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    payment.status = PaymentStatus.REFUNDED;
    await payment.save();

    // Cancel the associated booking
    await this.bookingsService.cancelBooking(payment.bookingId.toString());

    return payment;
  }

  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `TXN-${timestamp}-${randomStr}`.toUpperCase();
  }
}
