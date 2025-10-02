import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SettingsService } from './settings.service';
import { SettingType } from './system-setting.entity';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Public endpoint for frontend configuration
  @Get('public')
  async getPublicSettings() {
    return await this.settingsService.getPublicSettings();
  }

  // Admin-only endpoints
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getAllSettings(@Query('category') category?: string) {
    if (category) {
      return await this.settingsService.getSettingsByCategory(category);
    }
    return await this.settingsService.getAllSettings();
  }

  @Get(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getSetting(@Param('key') key: string) {
    return await this.settingsService.getSetting(key);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createSetting(
    @Body()
    body: {
      key: string;
      value: string;
      type: SettingType;
      description?: string;
      category?: string;
      isSystem?: boolean;
      isEditable?: boolean;
    },
    @Request() req: any,
  ) {
    return await this.settingsService.createSetting(body, req.user.id);
  }

  @Put(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateSetting(
    @Param('key') key: string,
    @Body() body: { value: string },
    @Request() req: any,
  ) {
    return await this.settingsService.updateSetting(key, body.value, req.user.id);
  }

  @Put('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async bulkUpdateSettings(
    @Body() body: { updates: Array<{ key: string; value: string }> },
    @Request() req: any,
  ) {
    return await this.settingsService.bulkUpdateSettings(body.updates, req.user.id);
  }

  @Delete(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deleteSetting(@Param('key') key: string) {
    await this.settingsService.deleteSetting(key);
    return { message: 'Setting deleted successfully' };
  }

  @Post('initialize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async initializeDefaultSettings() {
    await this.settingsService.initializeDefaultSettings();
    return { message: 'Default settings initialized successfully' };
  }
}