import { IsMongoId, IsDate, IsNumber, Min } from 'class-validator';
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
}
