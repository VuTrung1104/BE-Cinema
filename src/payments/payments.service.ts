import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument, PaymentStatus } from './schemas/payment.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateVNPayPaymentDto, VNPayReturnDto, VNPayIPNDto } from './dto/vnpay-payment.dto';
import { CreateMoMoPaymentDto, MoMoReturnDto, MoMoIPNDto } from './dto/momo-payment.dto';
import { BookingsService } from '../bookings/bookings.service';
import { VNPayService } from './services/vnpay.service';
import { MomoService } from './services/momo.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private bookingsService: BookingsService,
    private vnpayService: VNPayService,
    private momoService: MomoService,
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

  // ==================== MOMO PAYMENT METHODS ====================

  /**
   * Create MoMo payment
   */
  async createMoMoPayment(dto: CreateMoMoPaymentDto) {
    const { bookingId, amount, orderInfo } = dto;

    // Verify booking exists and is pending
    const booking = await this.bookingsService.findOne(bookingId);
    if (booking.status !== 'pending') {
      throw new BadRequestException('Booking is not in pending status');
    }

    // Generate orderId: bookingId-timestamp
    const orderId = `${bookingId}-${Date.now()}`;

    // Create payment record in DB
    const payment = new this.paymentModel({
      bookingId,
      amount,
      method: 'momo',
      status: PaymentStatus.PENDING,
      transactionId: orderId,
    });
    await payment.save();

    // Call MoMo API to get payment URL
    const momoResponse = await this.momoService.createPayment({
      ...dto,
      orderId,
    });

    this.logger.log(`MoMo payment created for booking ${bookingId}, orderId: ${orderId}`);

    return {
      paymentId: payment._id,
      paymentUrl: momoResponse.payUrl, // Rename payUrl to paymentUrl for FE
      qrCodeUrl: momoResponse.qrCodeUrl,
      orderId: momoResponse.orderId,
      requestId: momoResponse.requestId,
    };
  }

  /**
   * Handle MoMo Return - Process payment immediately (don't wait for IPN)
   */
  async handleMoMoReturn(data: MoMoReturnDto) {
    const { orderId, resultCode } = data;
    const bookingId = orderId.split('-')[0];

    this.logger.log(`=== MoMo Return Called === orderId: ${orderId}, resultCode: ${resultCode}`);

    // Process payment immediately based on resultCode
    if (resultCode === 0) {
      // SUCCESS - Confirm booking immediately
      try {
        this.logger.log(`MoMo Return - Payment SUCCESS for booking ${bookingId}`);
        
        const payment = await this.paymentModel.findOne({
          transactionId: orderId,
          status: PaymentStatus.PENDING,
        });

        if (!payment) {
          this.logger.warn(`MoMo Return - Payment not found or already processed: ${orderId}`);
        } else {
          this.logger.log(`MoMo Return - Found payment ${payment._id}, confirming booking...`);
          
          // Update payment status
          payment.status = PaymentStatus.COMPLETED;
          payment.paidAt = new Date();
          await payment.save();

          // Confirm booking and move seats from locked to booked
          await this.bookingsService.confirmBooking(payment.bookingId.toString());
          this.logger.log(`✅ MoMo Return - Booking ${payment.bookingId} CONFIRMED successfully!`);
        }
      } catch (error) {
        this.logger.error(`❌ MoMo Return - Error confirming booking: ${error.message}`, error.stack);
      }
    } else {
      // FAILED - Cancel booking immediately
      try {
        this.logger.log(`MoMo Return - Payment FAILED for booking ${bookingId}, code: ${resultCode}`);
        
        const payment = await this.paymentModel.findOne({
          transactionId: orderId,
          status: PaymentStatus.PENDING,
        });

        if (!payment) {
          this.logger.warn(`MoMo Return - Payment not found or already processed: ${orderId}`);
        } else {
          this.logger.log(`MoMo Return - Found payment ${payment._id}, cancelling booking...`);
          
          // Update payment status
          payment.status = PaymentStatus.FAILED;
          await payment.save();

          // Cancel booking and release seats
          await this.bookingsService.cancelBooking(payment.bookingId.toString());
          this.logger.log(`✅ MoMo Return - Booking ${payment.bookingId} cancelled successfully`);
        }
      } catch (error) {
        this.logger.error(`❌ MoMo Return - Error cancelling booking: ${error.message}`, error.stack);
      }
    }

    this.logger.log(`=== MoMo Return Completed ===`);

    // Return info for redirect
    return {
      success: resultCode === 0,
      bookingId,
      orderId,
    };
  }

  /**
   * Handle MoMo IPN - XỬ LÝ TOÀN BỘ business logic
   */
  async handleMoMoIPN(data: MoMoIPNDto) {
    const { orderId, resultCode, transId } = data;

    try {
      // 1. Verify signature
      const { isValid } = this.momoService.verifySignature(data);
      if (!isValid) {
        this.logger.log(`MoMo IPN - Invalid signature for order ${orderId}`);
        return { resultCode: 0, message: 'IPN received' };
      }

      // 2. Find payment
      const payment = await this.paymentModel.findOne({
        transactionId: orderId,
        status: PaymentStatus.PENDING,
      });

      if (!payment) {
        this.logger.log(`MoMo IPN - Payment not found for order ${orderId}`);
        return { resultCode: 0, message: 'IPN received' };
      }

      // 3. Update payment status: COMPLETED or FAILED
      if (resultCode === 0) {
        // Success - COMPLETED
        payment.status = PaymentStatus.COMPLETED;
        payment.paidAt = new Date();
        payment.transactionId = transId;
        await payment.save();

        // Confirm booking
        await this.bookingsService.confirmBooking(payment.bookingId.toString());
        this.logger.log(`MoMo IPN - Booking ${payment.bookingId} CONFIRMED`);
      } else {
        // Failed
        payment.status = PaymentStatus.FAILED;
        await payment.save();

        // Cancel booking and release seats
        await this.bookingsService.cancelBooking(payment.bookingId.toString());
        this.logger.log(`MoMo IPN - Booking ${payment.bookingId} CANCELLED and seats released (code: ${resultCode})`);
      }

      return { resultCode: 0, message: 'Success' };
    } catch (error) {
      // KHÔNG throw, chỉ log
      this.logger.log(`MoMo IPN processed for order ${orderId}`);
      return { resultCode: 0, message: 'IPN received' };
    }
  }


}
