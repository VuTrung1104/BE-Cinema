/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { StrategyOptions, JwtFromRequestFunction } from 'passport-jwt';
import type { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtFromRequest: JwtFromRequestFunction = (req: Request) => {
      const authHeader = req.get('authorization') ?? req.headers?.authorization;
      if (!authHeader) return null;
      const [scheme, token] = authHeader.split(' ');
      if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
      return token;
    };
    super({
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
    } as StrategyOptions);
  }

  validate(payload: { sub: number; email: string; fullName: string }) {
    return {
      userId: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
    };
  }
}
