import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { BookingsModule } from '../bookings/bookings.module';
import { VNPayService } from './services/vnpay.service';
import { MomoService } from './services/momo.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    BookingsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, VNPayService, MomoService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
