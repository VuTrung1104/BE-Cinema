import { IsString, IsArray, IsNumber, IsDate, IsOptional, IsEnum, Min, Max, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
import { MovieGenre } from '../schemas/movie.schema';

export class CreateMovieDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsArray()
  @IsEnum(MovieGenre, { each: true })
  genres: MovieGenre[];

  @IsNumber()
  @Min(1)
  duration: number;

  @IsDate()
  @Type(() => Date)
  releaseDate: Date;

  @IsOptional()
  @IsString()
  director?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cast?: string[];

  @IsOptional()
  @IsUrl()
  posterUrl?: string;

  @IsOptional()
  @IsUrl()
  trailerUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  rating?: number;
}
