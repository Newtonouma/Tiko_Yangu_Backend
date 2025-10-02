import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    console.log('🔐 JwtAuthGuard: Auth header:', authHeader);
    
    if (!authHeader) throw new UnauthorizedException('No token provided');
    const token = authHeader.split(' ')[1];
    console.log('🔐 JwtAuthGuard: Extracted token:', token ? 'Present' : 'Missing');
    
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'changeme',
      });
      console.log('🔐 JwtAuthGuard: JWT payload:', payload);
      
      // Transform payload to match expected user format
      const user = {
        id: payload.sub,
        userId: payload.sub,
        email: payload.username,
        role: payload.role
      };
      console.log('🔐 JwtAuthGuard: Setting request.user to:', user);
      
      request.user = user;
      return true;
    } catch (e) {
      console.log('🔐 JwtAuthGuard: JWT verification failed:', e.message);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
