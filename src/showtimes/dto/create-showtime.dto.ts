import { IsMongoId, IsDate, IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateShowtimeDto {
  @IsMongoId()
  movieId: string;

  @IsMongoId()
  theaterId: string;

  @IsDate()
  @Type(() => Date)
  startTime: Date;

  @IsDate()
  @Type(() => Date)
  endTime: Date;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  totalSeats?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rows?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  seatsPerRow?: number;
}
