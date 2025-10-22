import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'changeme',
    });
  }

  async validate(payload: any) {
    console.log('🔑 JWT Strategy validate called with payload:', payload);
    const user = {
      id: payload.sub,
      userId: payload.sub,
      email: payload.username,
      role: payload.role,
    };
    console.log('🔑 JWT Strategy returning user:', user);
    return user;
  }
}
