import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password.validator';

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  code: string;

  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
