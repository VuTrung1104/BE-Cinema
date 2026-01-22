import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const publicPaths = [
      '/api/v1/payments/momo-return',
      '/api/v1/payments/momo-ipn',
      '/api/v1/payments/momo/callback',
      '/api/v1/payments/vnpay-return',
      '/api/v1/payments/vnpay-ipn',
    ];

    if (isPublic || publicPaths.some((path) => request.path.startsWith(path))) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return user;
    }

    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
