import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService, UserEntity } from '../users/users.service.js';

type AuthUser = Pick<UserEntity, 'id' | 'email' | 'fullName'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = this.usersService.findByEmail(email);
    if (!user) return null;
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return null;
    const { id, email: e, fullName } = user;
    return { id, email: e, fullName };
  }

  async login(user: AuthUser) {
    const payload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: '15m',
        secret: process.env.JWT_SECRET || 'dev-secret',
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: '7d',
        secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      }),
    ]);
    return {
      accessToken,
      refreshToken,
      user: payload,
    };
  }

  async refreshToken(refreshToken: string) {
    const decoded = await this.jwtService.verifyAsync<{
      sub: number;
      email: string;
      fullName: string;
    }>(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    });
    const payload = {
      sub: decoded.sub,
      email: decoded.email,
      fullName: decoded.fullName,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
      secret: process.env.JWT_SECRET || 'dev-secret',
    });
    // rotate refresh token
    const newRefreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    });
    return { accessToken, refreshToken: newRefreshToken, user: payload };
  }
}
