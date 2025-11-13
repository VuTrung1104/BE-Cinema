import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TheaterDocument = Theater & Document;

@Schema({ timestamps: true })
export class Theater {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  address: string;

  @Prop()
  city: string;

  @Prop()
  phone: string;

  @Prop({ required: true })
  totalSeats: number;

  @Prop({ type: [Number], required: true })
  rows: number[]; // Array of seat counts per row

  @Prop({ default: true })
  isActive: boolean;
}

export const TheaterSchema = SchemaFactory.createForClass(Theater);

// Index for location-based queries
TheaterSchema.index({ city: 1 });
