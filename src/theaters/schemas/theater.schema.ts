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

// Indexes for efficient queries
TheaterSchema.index({ name: 'text' }); // Text search for theater names
TheaterSchema.index({ city: 1, isActive: 1 }); // Location-based queries with active filter
TheaterSchema.index({ isActive: 1 }); // Filter active theaters
