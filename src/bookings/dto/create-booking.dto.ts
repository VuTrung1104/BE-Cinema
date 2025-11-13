import { IsMongoId, IsArray, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsMongoId()
  showtimeId: string;

  @IsArray()
  @IsString({ each: true })
  seats: string[];
}
