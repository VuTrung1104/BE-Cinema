import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from '../users/schemas/user.schema';
import { VerificationCode, VerificationCodeDocument, OTPType } from './schemas/verification-code.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SendOTPDto } from './dto/send-otp.dto';
import { VerifyOTPDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../common/services/email.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(VerificationCode.name) private verificationCodeModel: Model<VerificationCodeDocument>,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, fullName, phone, role } = registerDto;

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Create user (password will be hashed by pre-save hook)
    const user = new this.userModel({
      email,
      password,
      fullName,
      phone,
      role,
    });

    await user.save();

    // Generate tokens
    const tokens = this.generateToken(user);

    return {
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user and explicitly select password field
    const user = await this.userModel.findOne({ email }).select('+password').exec();
    
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Verify password using schema method
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate tokens
    const tokens = this.generateToken(user);

    return {
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async validateUser(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).exec();
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    return user;
  }

  async validateUserCredentials(email: string, password: string): Promise<any> {
    // Find user and explicitly select password field
    const user = await this.userModel.findOne({ email }).select('+password').exec();
    
    if (!user) {
      return null;
    }

    // Check if user is active
    if (!user.isActive) {
      return null;
    }

    // Verify password using schema method
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return null;
    }

    // Return user without password
    return {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }

  private generateToken(user: UserDocument) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    return { accessToken, refreshToken };
  }

  // ==================== OTP SYSTEM ====================

  async sendOTP(sendOTPDto: SendOTPDto) {
    const { email, type } = sendOTPDto;

    // Check if email exists for forgot password
    if (type === OTPType.FORGOT_PASSWORD) {
      const user = await this.userModel.findOne({ email });
      if (!user) {
        throw new NotFoundException('Email not found');
      }
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiration time (10 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Create or update verification code
    await this.verificationCodeModel.findOneAndUpdate(
      { email, type },
      { code, expiresAt, isUsed: false },
      { upsert: true, new: true },
    );

    // Send email
    await this.emailService.sendOTP(email, code, type);

    return {
      message: 'OTP sent successfully',
      expiresIn: '10 minutes',
    };
  }

  async verifyOTP(verifyOTPDto: VerifyOTPDto) {
    const { email, code } = verifyOTPDto;

    const verificationCode = await this.verificationCodeModel.findOne({
      email,
      code,
      isUsed: false,
    });

    if (!verificationCode) {
      throw new BadRequestException('Invalid OTP code');
    }

    // Check if expired
    if (new Date() > verificationCode.expiresAt) {
      throw new BadRequestException('OTP code has expired');
    }

    // Mark as used
    verificationCode.isUsed = true;
    await verificationCode.save();

    return {
      message: 'OTP verified successfully',
      verified: true,
    };
  }

  // ==================== PASSWORD RESET ====================

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new NotFoundException('Email not found');
    }

    return this.sendOTP({ email, type: OTPType.FORGOT_PASSWORD });
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, code, newPassword } = resetPasswordDto;

    // Verify OTP first
    const verificationCode = await this.verificationCodeModel.findOne({
      email,
      code,
      type: OTPType.FORGOT_PASSWORD,
      isUsed: false,
    });

    if (!verificationCode) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    if (new Date() > verificationCode.expiresAt) {
      throw new BadRequestException('OTP code has expired');
    }

    // Find user and update password
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.password = newPassword;
    await user.save(); // Will trigger password hashing

    // Mark OTP as used
    verificationCode.isUsed = true;
    await verificationCode.save();

    return {
      message: 'Password reset successfully',
    };
  }

  // ==================== GOOGLE OAUTH ====================

  async googleLogin(userData: any) {
    const { email, fullName, googleId } = userData;

    // Check if user exists
    let user = await this.userModel.findOne({ email });

    if (!user) {
      // Create new user from Google
      user = new this.userModel({
        email,
        fullName,
        googleId,
        isEmailVerified: true, // Google emails are already verified
        isActive: true,
        role: 'user',
      });
      await user.save();
    } else if (!user.googleId) {
      // Link Google account to existing user
      user.googleId = googleId;
      user.isEmailVerified = true;
      await user.save();
    }

    // Generate tokens
    const tokens = this.generateToken(user);

    return {
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      ...tokens,
    };
  }
}
