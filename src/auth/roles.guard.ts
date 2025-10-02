import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    console.log('🛡️ RolesGuard: Required roles:', roles);
    
    if (!roles) return true;
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    console.log('🛡️ RolesGuard: User:', user);
    console.log('🛡️ RolesGuard: User role:', user?.role);
    console.log('🛡️ RolesGuard: Role check:', roles.includes(user?.role));
    
    if (!user || !roles.includes(user.role)) {
      console.log('❌ RolesGuard: Access denied. User role:', user?.role, 'Required roles:', roles);
      throw new ForbiddenException('Forbidden');
    }
    return true;
  }
}
