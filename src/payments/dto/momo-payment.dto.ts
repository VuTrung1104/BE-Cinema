import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMoMoPaymentDto {
  @ApiProperty({ example: 'booking_123456', description: 'Booking ID' })
  @IsString()
  bookingId: string;

  @ApiProperty({ example: 100000, description: 'Amount in VND' })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'Thanh toán vé xem phim', description: 'Order description', required: false })
  @IsString()
  @IsOptional()
  orderInfo?: string;

  @ApiProperty({ example: 'http://localhost:3001/payment/result', description: 'Redirect URL after payment', required: false })
  @IsString()
  @IsOptional()
  redirectUrl?: string;
}
