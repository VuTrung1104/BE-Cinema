import { IsEnum, IsString, IsOptional, IsMongoId } from 'class-validator';
import { ViolationType, ActionTaken } from '../schemas/violation.schema';

export class CreateViolationDto {
  @IsMongoId()
  userId: string;

  @IsEnum(ViolationType)
  violationType: ViolationType;

  @IsString()
  description: string;

  @IsEnum(ActionTaken)
  actionTaken: ActionTaken;

  @IsOptional()
  @IsString()
  note?: string;
}
