import { IsString, IsOptional, MinLength, IsEmail, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../schemas/user.schema';

export class UpdateUserDto {
  @ApiPropertyOptional({ 
    example: 'John Smith', 
    description: 'Full name of the user',
    minLength: 2
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  fullName?: string;

  @ApiPropertyOptional({ 
    example: '0912345678', 
    description: 'Phone number'
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ 
    example: '1990-01-15T00:00:00.000Z', 
    description: 'Date of birth in ISO 8601 format'
  })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ 
    example: 'john.smith@example.com', 
    description: 'Email address',
    format: 'email'
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email?: string;

  @ApiPropertyOptional({ 
    example: 'user', 
    description: 'User role',
    enum: UserRole
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be either user or admin' })
  role?: UserRole;
}
