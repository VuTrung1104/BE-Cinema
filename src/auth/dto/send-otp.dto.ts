import { IsEmail, IsEnum } from 'class-validator';
import { OTPType } from '../schemas/verification-code.schema';

export class SendOTPDto {
  @IsEmail()
  email: string;

  @IsEnum(OTPType)
  type: OTPType;
}
