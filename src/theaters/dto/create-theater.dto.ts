import { IsString, IsNumber, IsArray, IsOptional, Min } from 'class-validator';

export class CreateTheaterDto {
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  totalSeats?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  rows?: number[];
}
