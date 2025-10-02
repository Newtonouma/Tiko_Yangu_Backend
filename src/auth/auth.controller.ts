import { Controller, Post, Body, Req } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: { name: string; email: string; password: string },
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Req() req: any) {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    return this.authService.login(body.email, body.password, ipAddress);
  }
}
