import { Module, Global } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { QRCodeService } from './services/qrcode.service';

@Global()
@Module({
  providers: [EmailService, QRCodeService],
  exports: [EmailService, QRCodeService],
})
export class CommonModule {}
