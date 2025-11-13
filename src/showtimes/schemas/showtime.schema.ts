import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShowtimeDocument = Showtime & Document;

@Schema({ timestamps: true })
export class Showtime {
  @Prop({ type: Types.ObjectId, ref: 'Movie', required: true })
  movieId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Theater', required: true })
  theaterId: Types.ObjectId;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: true })
  endTime: Date;

  @Prop({ required: true })
  price: number;

  @Prop({ type: [String], default: [] })
  bookedSeats: string[]; // Array of seat numbers like ['A1', 'A2', 'B5']

  @Prop({ default: true })
  isActive: boolean;
}

export const ShowtimeSchema = SchemaFactory.createForClass(Showtime);

// Indexes for efficient queries
ShowtimeSchema.index({ movieId: 1, startTime: 1 });
ShowtimeSchema.index({ theaterId: 1, startTime: 1 });
ShowtimeSchema.index({ startTime: 1 });
