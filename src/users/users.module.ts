import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { Violation, ViolationSchema } from './schemas/violation.schema';
import { EmailService } from '../common/services/email.service';
import { CloudinaryService } from '../common/services/cloudinary.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Violation.name, schema: ViolationSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, EmailService, CloudinaryService],
  exports: [UsersService],
})
export class UsersModule {}
