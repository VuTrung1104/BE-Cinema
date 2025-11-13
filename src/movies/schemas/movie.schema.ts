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
}

export const MovieSchema = SchemaFactory.createForClass(Movie);

// Indexes
MovieSchema.index({ title: 'text' });
MovieSchema.index({ genres: 1 });
MovieSchema.index({ releaseDate: -1 });
