import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = User & Document & {
  comparePassword(candidatePassword: string): Promise<boolean>;
};

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: false, select: false })
  password: string;

  @Prop({ required: true })
  fullName: string;

  @Prop()
  phone: string;

  @Prop()
  dateOfBirth: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  avatar: string;

  @Prop({ default: false })
  isLocked: boolean;

  @Prop()
  lockUntil: Date;

  @Prop()
  lockReason: string;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ default: 0 })
  violationCount: number;

  @Prop({ unique: true, sparse: true })
  googleId: string;

  @Prop({ unique: true, sparse: true })
  facebookId: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes for efficient queries
// Note: Email index is already created via @Prop({ unique: true }) decorator
UserSchema.index({ role: 1, isActive: 1 }); // Admin queries for user management
UserSchema.index({ isLocked: 1 }); // Query locked users
UserSchema.index({ violationCount: -1 }); // Sort by violations
UserSchema.index({ fullName: 'text', email: 'text' }); // Text search for users

// Hash password before saving
UserSchema.pre('save', async function (next) {
  // Skip if no password (OAuth users)
  if (!this.password) {
    return next();
  }

  // Only hash if password is modified or new
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};
