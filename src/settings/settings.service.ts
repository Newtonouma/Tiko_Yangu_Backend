import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting, SettingType } from './system-setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepository: Repository<SystemSetting>,
  ) {}

  async initializeDefaultSettings(): Promise<void> {
    const defaultSettings = [
      {
        key: 'platform.name',
        value: 'Tikoyangu',
        type: SettingType.STRING,
        description: 'Platform name displayed throughout the application',
        category: 'general',
        isSystem: true,
      },
      {
        key: 'platform.description',
        value: 'Event Management Platform',
        type: SettingType.STRING,
        description: 'Platform description for marketing and SEO',
        category: 'general',
        isSystem: false,
      },
      {
        key: 'events.auto_approve',
        value: 'false',
        type: SettingType.BOOLEAN,
        description: 'Automatically approve new events without admin review',
        category: 'events',
        isSystem: false,
      },
      {
        key: 'events.max_per_organizer',
        value: '10',
        type: SettingType.NUMBER,
        description: 'Maximum number of events an organizer can create',
        category: 'events',
        isSystem: false,
      },
      {
        key: 'tickets.refund_period_days',
        value: '7',
        type: SettingType.NUMBER,
        description: 'Number of days before event when refunds are allowed',
        category: 'tickets',
        isSystem: false,
      },
      {
        key: 'notifications.email_enabled',
        value: 'true',
        type: SettingType.BOOLEAN,
        description: 'Enable email notifications',
        category: 'notifications',
        isSystem: false,
      },
      {
        key: 'notifications.sms_enabled',
        value: 'true',
        type: SettingType.BOOLEAN,
        description: 'Enable SMS notifications',
        category: 'notifications',
        isSystem: false,
      },
      {
        key: 'payments.mpesa_enabled',
        value: 'true',
        type: SettingType.BOOLEAN,
        description: 'Enable Mpesa payments',
        category: 'payments',
        isSystem: false,
      },
      {
        key: 'maintenance.mode',
        value: 'false',
        type: SettingType.BOOLEAN,
        description: 'Put the platform in maintenance mode',
        category: 'system',
        isSystem: true,
      },
      {
        key: 'security.jwt_expiry_hours',
        value: '24',
        type: SettingType.NUMBER,
        description: 'JWT token expiry time in hours',
        category: 'security',
        isSystem: true,
      },
    ];

    for (const settingData of defaultSettings) {
      const existingSetting = await this.settingRepository.findOne({
        where: { key: settingData.key },
      });

      if (!existingSetting) {
        const setting = this.settingRepository.create(settingData);
        await this.settingRepository.save(setting);
      }
    }
  }

  async getAllSettings(): Promise<SystemSetting[]> {
    return await this.settingRepository.find({
      order: { category: 'ASC', key: 'ASC' },
    });
  }

  async getSettingsByCategory(category: string): Promise<SystemSetting[]> {
    return await this.settingRepository.find({
      where: { category },
      order: { key: 'ASC' },
    });
  }

  async getSetting(key: string): Promise<SystemSetting> {
    const setting = await this.settingRepository.findOne({ where: { key } });
    if (!setting) {
      throw new NotFoundException(`Setting with key '${key}' not found`);
    }
    return setting;
  }

  async getSettingValue<T = any>(key: string): Promise<T> {
    const setting = await this.getSetting(key);
    return this.parseSettingValue(setting) as T;
  }

  async updateSetting(
    key: string,
    value: string,
    adminUserId: number,
  ): Promise<SystemSetting> {
    const setting = await this.getSetting(key);

    if (!setting.isEditable) {
      throw new BadRequestException(`Setting '${key}' is not editable`);
    }

    // Validate value based on type
    this.validateSettingValue(setting.type, value);

    setting.value = value;
    setting.lastModifiedBy = adminUserId;

    return await this.settingRepository.save(setting);
  }

  async createSetting(
    settingData: {
      key: string;
      value: string;
      type: SettingType;
      description?: string;
      category?: string;
      isSystem?: boolean;
      isEditable?: boolean;
    },
    adminUserId: number,
  ): Promise<SystemSetting> {
    const existingSetting = await this.settingRepository.findOne({
      where: { key: settingData.key },
    });

    if (existingSetting) {
      throw new BadRequestException(
        `Setting with key '${settingData.key}' already exists`,
      );
    }

    // Validate value based on type
    this.validateSettingValue(settingData.type, settingData.value);

    const setting = this.settingRepository.create({
      ...settingData,
      lastModifiedBy: adminUserId,
    });

    return await this.settingRepository.save(setting);
  }

  async deleteSetting(key: string): Promise<void> {
    const setting = await this.getSetting(key);

    if (setting.isSystem) {
      throw new BadRequestException(
        `System setting '${key}' cannot be deleted`,
      );
    }

    await this.settingRepository.delete({ key });
  }

  async getPublicSettings(): Promise<Record<string, any>> {
    // Only return non-sensitive settings that can be used by the frontend
    const publicKeys = [
      'platform.name',
      'platform.description',
      'events.auto_approve',
      'notifications.email_enabled',
      'notifications.sms_enabled',
      'payments.mpesa_enabled',
      'maintenance.mode',
    ];

    const settings = await this.settingRepository.find({
      where: publicKeys.map((key) => ({ key })),
    });

    const publicSettings: Record<string, any> = {};
    settings.forEach((setting) => {
      publicSettings[setting.key] = this.parseSettingValue(setting);
    });

    return publicSettings;
  }

  async bulkUpdateSettings(
    updates: Array<{ key: string; value: string }>,
    adminUserId: number,
  ): Promise<SystemSetting[]> {
    const updatedSettings: SystemSetting[] = [];

    for (const update of updates) {
      try {
        const updatedSetting = await this.updateSetting(
          update.key,
          update.value,
          adminUserId,
        );
        updatedSettings.push(updatedSetting);
      } catch (error) {
        // Log error but continue with other updates
        console.error(`Failed to update setting ${update.key}:`, error.message);
      }
    }

    return updatedSettings;
  }

  private parseSettingValue(setting: SystemSetting): any {
    switch (setting.type) {
      case SettingType.BOOLEAN:
        return setting.value.toLowerCase() === 'true';
      case SettingType.NUMBER:
        return parseFloat(setting.value);
      case SettingType.JSON:
        try {
          return JSON.parse(setting.value);
        } catch {
          return null;
        }
      case SettingType.STRING:
      default:
        return setting.value;
    }
  }

  private validateSettingValue(type: SettingType, value: string): void {
    switch (type) {
      case SettingType.BOOLEAN:
        if (!['true', 'false'].includes(value.toLowerCase())) {
          throw new BadRequestException(
            'Boolean setting must be "true" or "false"',
          );
        }
        break;
      case SettingType.NUMBER:
        if (isNaN(parseFloat(value))) {
          throw new BadRequestException(
            'Number setting must be a valid number',
          );
        }
        break;
      case SettingType.JSON:
        try {
          JSON.parse(value);
        } catch {
          throw new BadRequestException('JSON setting must be valid JSON');
        }
        break;
      case SettingType.STRING:
      default:
        // String values are always valid
        break;
    }
  }
}
