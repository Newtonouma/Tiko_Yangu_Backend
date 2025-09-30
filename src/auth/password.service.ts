import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PasswordService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    user.resetPasswordToken = uuidv4();
    await this.userService.updateUser(user.id, { resetPasswordToken: user.resetPasswordToken });
    // Here you would send an email with the token (user.resetPasswordToken)
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.userService.findByResetToken(token);
    if (!user) throw new BadRequestException('Invalid or expired token');
  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined;
  await this.userService.updateUser(user.id, user);
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.userService.findById(userId);
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) throw new UnauthorizedException('Old password is incorrect');
    user.password = await bcrypt.hash(newPassword, 10);
    await this.userService.updateUser(user.id, user);
  }
}
