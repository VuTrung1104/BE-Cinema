import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Violation, ViolationDocument } from './schemas/violation.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { LockUserDto } from './dto/lock-user.dto';
import { CreateViolationDto } from './dto/create-violation.dto';
import { EmailService } from '../common/services/email.service';
import { CloudinaryService } from '../common/services/cloudinary.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Violation.name) private violationModel: Model<ViolationDocument>,
    private emailService: EmailService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async findAll() {
    return this.userModel.find().select('-password').exec();
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).select('-password').exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  async updateProfile(userId: string, updateUserDto: UpdateUserDto) {
    const { email, ...updateData } = updateUserDto;

    // If email is being updated, check if it's already taken
    if (email) {
      const existingUser = await this.userModel.findOne({ 
        email, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        throw new ConflictException('Email is already in use');
      }
      updateData['email'] = email;
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, updateData, { new: true })
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  async getProfile(userId: string) {
    return this.findOne(userId);
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto, currentUserId?: string) {
    const { email, role, ...updateData } = updateUserDto;

    // Get target user to check if they're super admin
    const targetUser = await this.userModel.findById(userId).exec();
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Security: Protect super admin from any modifications
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (superAdminEmail && targetUser.email === superAdminEmail) {
      throw new BadRequestException('Super admin account cannot be modified');
    }

    // Security: Prevent admin from changing their own role
    if (role && currentUserId && userId === currentUserId) {
      throw new BadRequestException('You cannot change your own role');
    }

    if (email) {
      const existingUser = await this.userModel.findOne({ 
        email, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        throw new ConflictException('Email is already in use');
      }
      updateData['email'] = email;
    }

    // Add role to updateData if provided and validation passed
    if (role !== undefined) {
      updateData['role'] = role;
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, updateData, { new: true })
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  // ==================== AVATAR UPLOAD ====================

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const user = await this.findOne(userId);

    // Delete old avatar from Cloudinary if exists
    if (user.avatar) {
      const publicId = this.extractPublicId(user.avatar);
      if (publicId) {
        await this.cloudinaryService.deleteImage(publicId);
      }
    }

    // Upload new avatar
    const result = await this.cloudinaryService.uploadImage(file, 'be-cinema/avatars');

    // Update user avatar
    user.avatar = result.secure_url;
    await user.save();

    return {
      message: 'Avatar uploaded successfully',
      avatar: result.secure_url,
    };
  }

  private extractPublicId(url: string): string | null {
    const match = url.match(/\/v\d+\/(.+)\.\w+$/);
    return match ? match[1] : null;
  }

  // ==================== USER LOCK/UNLOCK ====================

  async lockUser(userId: string, lockUserDto: LockUserDto, adminId: string) {
    const user = await this.findOne(userId);

    if (user.isLocked) {
      throw new BadRequestException('User is already locked');
    }

    const { reason, lockUntil } = lockUserDto;
    const lockUntilDate = lockUntil ? new Date(lockUntil) : null;

    // If lockUntil is provided, validate it's in the future
    if (lockUntilDate && lockUntilDate <= new Date()) {
      throw new BadRequestException('Lock until date must be in the future');
    }

    user.isLocked = true;
    user.lockUntil = lockUntilDate;
    user.lockReason = reason;
    await user.save();

    // Send notification email
    if (lockUntilDate) {
      await this.emailService.sendAccountLockedNotification(
        user.email,
        reason,
        lockUntilDate,
      );
    }

    return {
      message: 'User locked successfully',
      lockedUntil: lockUntilDate,
    };
  }

  async unlockUser(userId: string) {
    const user = await this.findOne(userId);

    if (!user.isLocked) {
      throw new BadRequestException('User is not locked');
    }

    user.isLocked = false;
    user.lockUntil = null;
    user.lockReason = null;
    await user.save();

    return {
      message: 'User unlocked successfully',
    };
  }

  async checkUserLockStatus(userId: string) {
    const user = await this.findOne(userId);

    // Auto-unlock if lock period has expired
    if (user.isLocked && user.lockUntil && new Date() > user.lockUntil) {
      user.isLocked = false;
      user.lockUntil = null;
      user.lockReason = null;
      await user.save();
      return { isLocked: false };
    }

    return {
      isLocked: user.isLocked,
      lockUntil: user.lockUntil,
      lockReason: user.lockReason,
    };
  }

  // ==================== VIOLATIONS ====================

  async createViolation(createViolationDto: CreateViolationDto, reportedBy: string) {
    const { userId, violationType, description, actionTaken, note } = createViolationDto;

    const user = await this.findOne(userId);

    // Create violation record
    const violation = new this.violationModel({
      userId,
      violationType,
      description,
      actionTaken,
      note,
      reportedBy,
    });

    await violation.save();

    // Increment violation count
    user.violationCount += 1;
    await user.save();

    return {
      message: 'Violation recorded successfully',
      violation,
      totalViolations: user.violationCount,
    };
  }

  async getUserViolations(userId: string) {
    const violations = await this.violationModel
      .find({ userId })
      .populate('reportedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .exec();

    return violations;
  }

  async getAllViolations(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [violations, total] = await Promise.all([
      this.violationModel
        .find()
        .populate('userId', 'fullName email')
        .populate('reportedBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.violationModel.countDocuments(),
    ]);

    return {
      violations,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    };
  }
}
