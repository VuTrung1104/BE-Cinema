import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import type { UserEntity } from '../../users/users.service.js';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor() {
    super({
      clientID: process.env.FACEBOOK_APP_ID || '',
      clientSecret: process.env.FACEBOOK_APP_SECRET || '',
      callbackURL: process.env.FACEBOOK_CALLBACK_URL || '',
      profileFields: ['id', 'displayName', 'emails'],
      scope: ['email'],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    const email = (profile.emails?.[0]?.value as string) ?? '';
    const fullName = profile.displayName ?? 'User';
    const authUser: Pick<UserEntity, 'id' | 'email' | 'fullName'> = {
      id: Number(profile.id) || Date.now(),
      email,
      fullName,
    };
    return authUser;
  }
}
