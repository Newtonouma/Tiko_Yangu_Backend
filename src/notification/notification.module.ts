import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [EmailService, SmsService],
  exports: [EmailService, SmsService],
})
export class NotificationModule {}
