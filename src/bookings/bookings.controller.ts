import { Controller, Get, Post, Body, Param, Patch, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking (PENDING status, requires payment)' })
  @ApiResponse({ status: 201, description: 'Booking created successfully with PENDING status' })
  @ApiResponse({ status: 400, description: 'Bad request - seats already booked or invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @GetUser('userId') userId: string,
    @Body() createBookingDto: CreateBookingDto,
  ) {
    return this.bookingsService.create(userId, createBookingDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bookings (User sees own bookings, Admin sees all)' })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
  findAll(@GetUser('userId') userId: string, @GetUser('role') role: string) {
    // Admin can see all bookings, users can only see their own
    return this.bookingsService.findAll(role === UserRole.ADMIN ? undefined : userId);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get booking by booking code' })
  @ApiResponse({ status: 200, description: 'Booking found' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  findByCode(@Param('code') code: string) {
    return this.bookingsService.findByCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiResponse({ status: 200, description: 'Booking found' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirm booking - generates QR and sends email (Admin only)' })
  @ApiResponse({ status: 200, description: 'Booking confirmed successfully' })
  @ApiResponse({ status: 400, description: 'Booking is not in pending status' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  confirmBooking(@Param('id') id: string) {
    return this.bookingsService.confirmBooking(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel booking and release seats' })
  @ApiResponse({ status: 200, description: 'Booking cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  cancelBooking(@Param('id') id: string) {
    return this.bookingsService.cancelBooking(id);
  }

  @Post('verify-qr')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  verifyQRCode(@Body('qrData') qrData: string) {
    return this.bookingsService.verifyQRCode(qrData);
  }

  @Post(':id/generate-qr')
  async generateQRCode(@Param('id') id: string) {
    return this.bookingsService.generateBookingQRCode(id);
  }
}
