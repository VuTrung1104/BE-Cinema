import {
  Controller,
  Post,
  Request,
  UseGuards,
  Body,
  Get,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import type { UserEntity } from '../users/users.service.js';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
interface AuthenticatedRequest {
  user: Omit<UserEntity, 'passwordHash'>;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: AuthenticatedRequest) {
    return this.authService.login(req.user);
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @UseGuards(AuthGuard('google'))
  @Get('google')
  async googleLogin() {}

  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleCallback(
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const result = await this.authService.login(req.user);
    const url =
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback` +
      `?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}&user=${encodeURIComponent(
        JSON.stringify(result.user),
      )}`;
    return res.redirect(url);
  }

  @UseGuards(AuthGuard('facebook'))
  @Get('facebook')
  async facebookLogin() {}

  @UseGuards(AuthGuard('facebook'))
  @Get('facebook/callback')
  async facebookCallback(
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const result = await this.authService.login(req.user);
    const url =
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback` +
      `?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}&user=${encodeURIComponent(
        JSON.stringify(result.user),
      )}`;
    return res.redirect(url);
  }
}
