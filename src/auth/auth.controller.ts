import { Controller, Post, Body, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: any,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    return this.authService.login(body.email, body.password, ipAddress);
  }
}
