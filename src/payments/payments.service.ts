import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument, PaymentStatus } from './schemas/payment.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateVNPayPaymentDto, VNPayReturnDto, VNPayIPNDto } from './dto/vnpay-payment.dto';
import { BookingsService } from '../bookings/bookings.service';
import { VNPayService } from './services/vnpay.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private bookingsService: BookingsService,
    private vnpayService: VNPayService,
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

  // ============ VNPay Integration Methods ============

  /**
   * Create VNPay payment and return payment URL
   */
  async createVNPayPayment(
    createVNPayPaymentDto: CreateVNPayPaymentDto,
    ipAddr: string,
  ) {
    const { bookingId, amount, bankCode, locale } = createVNPayPaymentDto;

    // Verify booking exists and is pending
    const booking = await this.bookingsService.findOne(bookingId);
    if (booking.status !== 'pending') {
      throw new BadRequestException('Booking is not in pending status');
    }

    // Check if payment already exists for this booking
    const existingPayment = await this.paymentModel.findOne({
      bookingId,
      status: { $in: [PaymentStatus.PENDING, PaymentStatus.COMPLETED] },
    });

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.COMPLETED) {
        throw new BadRequestException('Payment already completed for this booking');
      }
      // If pending, we can create a new payment URL
    }

    // Create payment record
    const transactionId = this.generateTransactionId();
    const payment = new this.paymentModel({
      bookingId,
      amount,
      method: 'vnpay',
      transactionId,
      status: PaymentStatus.PENDING,
    });
    await payment.save();

    // Generate VNPay payment URL
    const paymentUrl = this.vnpayService.createPaymentUrl(
      { bookingId, amount, bankCode, locale },
      ipAddr,
    );

    this.logger.log(`Created VNPay payment for booking ${bookingId}`);

    return {
      paymentId: payment._id,
      paymentUrl,
      transactionId,
      amount,
    };
  }

  /**
   * Handle VNPay return callback (user redirected here after payment)
   */
  async handleVNPayReturn(vnpParams: VNPayReturnDto) {
    const verifyResult = this.vnpayService.verifyReturnUrl(vnpParams);

    if (!verifyResult.isValid) {
      this.logger.error('Invalid VNPay signature on return');
      return {
        success: false,
        message: 'Invalid payment signature',
      };
    }

    const orderId = vnpParams.vnp_TxnRef; // Format: {bookingId}-{timestamp}
    const bookingId = orderId.split('-')[0];

    if (verifyResult.data && vnpParams.vnp_ResponseCode === '00') {
      // Payment successful
      await this.completeVNPayPayment(bookingId, verifyResult.data);

      return {
        success: true,
        message: 'Payment successful',
        bookingId,
        data: verifyResult.data,
      };
    } else {
      // Payment failed
      await this.failVNPayPayment(bookingId, vnpParams.vnp_ResponseCode);

      return {
        success: false,
        message: verifyResult.message,
        bookingId,
      };
    }
  }

  /**
   * Handle VNPay IPN (Instant Payment Notification)
   * This is called by VNPay server to confirm payment
   */
  async handleVNPayIPN(vnpParams: VNPayIPNDto) {
    const verifyResult = this.vnpayService.verifyReturnUrl(vnpParams);

    if (!verifyResult.isValid) {
      this.logger.error('Invalid VNPay signature on IPN');
      return {
        success: false,
        message: 'Invalid signature',
      };
    }

    const orderId = vnpParams.vnp_TxnRef;
    const bookingId = orderId.split('-')[0];

    // Check if payment already processed
    const payment = await this.paymentModel.findOne({
      bookingId,
      status: PaymentStatus.COMPLETED,
    });

    if (payment) {
      this.logger.log(`Payment already processed for booking ${bookingId}`);
      return {
        success: true,
        message: 'Payment already confirmed',
      };
    }

    if (verifyResult.data && vnpParams.vnp_ResponseCode === '00') {
      // Payment successful
      await this.completeVNPayPayment(bookingId, verifyResult.data);

      return {
        success: true,
        message: 'Payment confirmed',
      };
    } else {
      // Payment failed
      await this.failVNPayPayment(bookingId, vnpParams.vnp_ResponseCode);

      return {
        success: false,
        message: verifyResult.message,
      };
    }
  }

  /**
   * Complete VNPay payment (mark as completed and confirm booking)
   */
  private async completeVNPayPayment(bookingId: string, vnpData: any) {
    // Update payment status
    const payment = await this.paymentModel.findOne({
      bookingId,
      status: PaymentStatus.PENDING,
    });

    if (payment) {
      payment.status = PaymentStatus.COMPLETED;
      payment.paidAt = new Date();
      payment.transactionId = vnpData.transactionNo || payment.transactionId;
      await payment.save();

      // Confirm booking
      await this.bookingsService.confirmBooking(bookingId);

      this.logger.log(`VNPay payment completed for booking ${bookingId}`);
    }
  }

  /**
   * Mark VNPay payment as failed
   */
  private async failVNPayPayment(bookingId: string, responseCode: string) {
    const payment = await this.paymentModel.findOne({
      bookingId,
      status: PaymentStatus.PENDING,
    });

    if (payment) {
      payment.status = PaymentStatus.FAILED;
      await payment.save();

      this.logger.warn(
        `VNPay payment failed for booking ${bookingId}, code: ${responseCode}`,
      );
    }
  }
}
