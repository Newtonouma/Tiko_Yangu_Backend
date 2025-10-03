import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { User, UserRole } from '../user/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../audit/audit-log.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async validateUser(email: string, pass: string): Promise<User> {
    const user = await this.userService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(pass, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(email: string, password: string, ipAddress?: string) {
    const user = await this.validateUser(email, password);
    
    // Only allow admin and event_organizer roles to login
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.EVENT_ORGANIZER
    ) {
      throw new UnauthorizedException(
        'Access denied. This system is restricted to event organizers and administrators.',
      );
    }
    
    // Log successful login
    await this.auditService.logUserAction(
      AuditAction.LOGIN,
      AuditEntityType.USER,
      user,
      {
        description: `Login successful for ${user.role} user`,
        metadata: { ipAddress, loginTime: new Date() },
      },
    );

    const payload = { username: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(data: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    organization?: string;
  }) {
    const existing = await this.userService.findByEmail(data.email);
    if (existing) throw new BadRequestException('Email already in use');
    
    // Only allow admin and event_organizer roles for registration
    const allowedRole = data.role || UserRole.EVENT_ORGANIZER;
    if (allowedRole !== UserRole.ADMIN && allowedRole !== UserRole.EVENT_ORGANIZER) {
      throw new BadRequestException('Invalid role. Only admin and event_organizer roles are allowed.');
    }
    
    return this.userService.createUser({
      ...data,
      role: allowedRole,
    });
  }
}
