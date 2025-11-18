import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VerificationCodeDocument = VerificationCode & Document;

export enum OTPType {
  REGISTER = 'register',
  FORGOT_PASSWORD = 'forgot_password',
  EMAIL_VERIFICATION = 'email_verification',
}

@Schema({ timestamps: true })
export class VerificationCode {
  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true })
  code: string;

  @Prop({ type: String, enum: OTPType, required: true })
  type: OTPType;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  isUsed: boolean;
}

export const VerificationCodeSchema = SchemaFactory.createForClass(VerificationCode);

// Index for cleanup expired codes
VerificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for faster lookups
VerificationCodeSchema.index({ email: 1, type: 1 });
