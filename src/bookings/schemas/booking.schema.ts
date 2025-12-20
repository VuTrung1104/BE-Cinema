import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingDocument = Booking & Document;

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Showtime', required: true })
  showtimeId: Types.ObjectId;

  @Prop({ type: [String], required: true })
  seats: string[]; // Array of seat numbers like ['A1', 'A2']

  @Prop({ required: true })
  totalPrice: number;

  @Prop({ type: String, enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Prop()
  bookingCode: string; // Unique booking reference code

  @Prop()
  paymentId: Types.ObjectId;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

// Indexes for efficient queries
BookingSchema.index({ userId: 1, createdAt: -1 }); // User's booking history
BookingSchema.index({ showtimeId: 1 }); // Bookings per showtime
BookingSchema.index({ bookingCode: 1 }, { unique: true }); // Unique booking lookup
BookingSchema.index({ status: 1, createdAt: -1 }); // Filter by status
BookingSchema.index({ userId: 1, status: 1 }); // User's bookings by status
