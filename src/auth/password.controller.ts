import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { PasswordService } from './password.service';
import {
  ForgotPasswordDto,
  ChangePasswordDto,
  ResetPasswordDto,
} from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class PasswordController {
  constructor(private readonly passwordService: PasswordService) {}

  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.passwordService.requestPasswordReset(body.email);
    return { message: 'If the email exists, a reset link has been sent.' };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.passwordService.resetPassword(body.token, body.newPassword);
    return { message: 'Password has been reset.' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Req() req, @Body() body: ChangePasswordDto) {
    await this.passwordService.changePassword(
      req.user.userId,
      body.oldPassword,
      body.newPassword,
    );
    return { message: 'Password changed successfully.' };
  }
}
