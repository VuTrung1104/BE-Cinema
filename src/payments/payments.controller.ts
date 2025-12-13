import { Controller, Get, Post, Body, Param, Patch, UseGuards, Query, Ip, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateVNPayPaymentDto, VNPayReturnDto } from './dto/vnpay-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { PaymentStatus } from './schemas/payment.schema';
import { Request, Response } from 'express';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a payment record' })\n  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Post(':id/process')
  @ApiOperation({ summary: 'Process payment (simulate payment completion)' })
  @ApiResponse({ status: 200, description: 'Payment processed successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  processPayment(@Param('id') id: string) {
    return this.paymentsService.processPayment(id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all payments with filters (Admin only)' })
  @ApiQuery({ name: 'bookingId', required: false, description: 'Filter by booking ID' })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus, description: 'Filter by payment status' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  findAll(
    @Query('bookingId') bookingId?: string,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.paymentsService.findAll({ bookingId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment found' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id/refund')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Refund payment and cancel booking (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payment refunded successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  refund(@Param('id') id: string) {
    return this.paymentsService.refund(id);
  }

  // VNPay endpoints
  @Post('vnpay/create')
  @ApiOperation({ summary: 'Create VNPay payment URL' })
  @ApiResponse({ status: 200, description: 'VNPay payment URL created successfully', schema: { example: { paymentId: 'xxx', paymentUrl: 'https://sandbox.vnpayment.vn/...' } } })
  @ApiResponse({ status: 400, description: 'Bad request' })
  createVNPayPayment(
    @Body() createVNPayPaymentDto: CreateVNPayPaymentDto,
    @Ip() ipAddr: string,
  ) {
    return this.paymentsService.createVNPayPayment(createVNPayPaymentDto, ipAddr);
  }

  @Get('vnpay-return')
  @ApiOperation({ summary: 'VNPay return URL callback handler (redirects to frontend)' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend success or failure page' })
  async vnpayReturn(@Query() query: VNPayReturnDto, @Res() res: Response) {
    const result = await this.paymentsService.handleVNPayReturn(query);
    
    // Redirect to frontend with result
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    if (result.success) {
      return res.redirect(`${frontendUrl}/payment/success?bookingId=${result.bookingId}`);
    } else {
      return res.redirect(`${frontendUrl}/payment/failed?message=${encodeURIComponent(result.message)}`);
    }
  }

  @Post('vnpay-ipn')
  @ApiOperation({ summary: 'VNPay IPN (Instant Payment Notification) handler' })
  @ApiResponse({ status: 200, description: 'IPN processed successfully', schema: { example: { RspCode: '00', Message: 'Confirm Success' } } })
  @ApiResponse({ status: 400, description: 'Invalid signature', schema: { example: { RspCode: '99', Message: 'Invalid signature' } } })
  async vnpayIPN(@Body() body: any, @Query() query: any) {
    // VNPay sends data as query params, not body
    const result = await this.paymentsService.handleVNPayIPN(query);
    
    // Return response to VNPay
    return {
      RspCode: result.success ? '00' : '99',
      Message: result.message,
    };
  }
}
