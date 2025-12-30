import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('FACEBOOK_APP_ID', ''),
      clientSecret: configService.get<string>('FACEBOOK_APP_SECRET', ''),
      callbackURL: configService.get<string>('FACEBOOK_CALLBACK_URL', 'http://localhost:5000/api/v1/auth/facebook/callback'),
      profileFields: ['id', 'displayName', 'emails'],
      scope: ['email'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile) {
    const email = profile.emails?.[0]?.value ?? '';
    const fullName = profile.displayName ?? 'User';
    
    return {
      email,
      fullName,
      facebookId: profile.id,
    };
  }
}
