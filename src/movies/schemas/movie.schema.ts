import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MovieDocument = Movie & Document;

export enum MovieGenre {
  ACTION = 'action',
  COMEDY = 'comedy',
  DRAMA = 'drama',
  HORROR = 'horror',
  ROMANCE = 'romance',
  SCI_FI = 'sci-fi',
  THRILLER = 'thriller',
  ANIMATION = 'animation',
}

@Schema({ timestamps: true })
export class Movie {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], enum: MovieGenre })
  genres: MovieGenre[];

  @Prop({ required: true })
  duration: number; // in minutes

  @Prop({ required: true })
  releaseDate: Date;

  @Prop()
  director: string;

  @Prop({ type: [String] })
  cast: string[];

  @Prop()
  posterUrl: string;

  @Prop()
  trailerUrl: string;

  @Prop({ min: 0, max: 10 })
  rating: number;

  @Prop({ default: true })
  isNowShowing: boolean;

  @Prop({
    type: String,
    enum: ['now-showing', 'coming-soon', 'ended'],
    default: 'now-showing'
  })
  status: string;
}

export const MovieSchema = SchemaFactory.createForClass(Movie);

// Indexes for efficient queries
MovieSchema.index({ title: 'text', description: 'text' }); // Full text search
MovieSchema.index({ genres: 1, isNowShowing: 1 }); // Filter by genre and showing status
MovieSchema.index({ releaseDate: -1, isNowShowing: 1 }); // Sort by release date with filter
MovieSchema.index({ rating: -1 }); // Sort by rating
MovieSchema.index({ isNowShowing: 1, releaseDate: -1 }); // Now showing movies sorted
