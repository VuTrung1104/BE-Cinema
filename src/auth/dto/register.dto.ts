import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/schemas/user.schema';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class RegisterDto {
  @ApiProperty({ 
    example: 'john@example.com', 
    description: 'User email address',
    format: 'email'
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @ApiProperty({ 
    example: 'Pass@123', 
    description: 'User password (minimum 8 characters, must contain uppercase, lowercase, number, and special character)',
    minLength: 8
  })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiProperty({ 
    example: 'John Doe', 
    description: 'Full name of the user',
    minLength: 2
  })
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  fullName: string;

  @ApiPropertyOptional({ 
    example: '0123456789', 
    description: 'Phone number (optional)'
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ 
    example: 'user',
    enum: UserRole,
    description: 'User role (default: user)',
    default: UserRole.USER
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be either user or admin' })
  role?: UserRole;
}
