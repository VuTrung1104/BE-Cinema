import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ViolationDocument = Violation & Document;

export enum ViolationType {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  FAKE_BOOKING = 'fake_booking',
  PAYMENT_FRAUD = 'payment_fraud',
  OTHER = 'other',
}

export enum ActionTaken {
  WARNING = 'warning',
  TEMPORARY_BAN = 'temporary_ban',
  PERMANENT_BAN = 'permanent_ban',
  ACCOUNT_LOCKED = 'account_locked',
}

@Schema({ timestamps: true })
export class Violation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ViolationType, required: true })
  violationType: ViolationType;

  @Prop({ required: true })
  description: string;

  @Prop({ type: String, enum: ActionTaken, required: true })
  actionTaken: ActionTaken;

  @Prop()
  note: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reportedBy: Types.ObjectId;
}

export const ViolationSchema = SchemaFactory.createForClass(Violation);

// Index for user violations lookup
ViolationSchema.index({ userId: 1, createdAt: -1 });
