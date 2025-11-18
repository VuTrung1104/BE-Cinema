import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SendOTPDto } from './dto/send-otp.dto';
import { VerifyOTPDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GetUser } from './decorators/get-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user', description: 'Create a new user account with email and password' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user', description: 'Authenticate user and receive JWT access token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful, returns user info and access token' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user', description: 'Logout endpoint (JWT is stateless, client should remove token)' })
  @ApiResponse({ status: 200, description: 'Logout message returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  async logout(@GetUser('userId') userId: string) {
    return {
      message: 'Logout successful. Please remove the token from client storage.',
    };
  }

  @Post('send-otp')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP code', description: 'Send a 6-digit OTP code to email for verification (Rate limit: 5 per hour)' })
  @ApiBody({ type: SendOTPDto })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async sendOTP(@Body() sendOTPDto: SendOTPDto) {
    return this.authService.sendOTP(sendOTPDto);
  }

  @Post('verify-otp')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 600000 } }) // 10 requests per 10 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code', description: 'Verify the 6-digit OTP code sent to email (Rate limit: 10 per 10 minutes)' })
  @ApiBody({ type: VerifyOTPDto })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async verifyOTP(@Body() verifyOTPDto: VerifyOTPDto) {
    return this.authService.verifyOTP(verifyOTPDto);
  }

  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset', description: 'Send OTP code for password reset (Rate limit: 3 per hour)' })
  @ApiBody({ schema: { properties: { email: { type: 'string', format: 'email' } } } })
  @ApiResponse({ status: 200, description: 'Password reset OTP sent' })
  @ApiResponse({ status: 404, description: 'Email not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with OTP', description: 'Reset password using verified OTP code (Rate limit: 5 per hour)' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid OTP or validation error' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
