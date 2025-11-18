import { IsString, IsOptional, IsDateString } from 'class-validator';

export class LockUserDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsDateString()
  lockUntil?: string;
}
