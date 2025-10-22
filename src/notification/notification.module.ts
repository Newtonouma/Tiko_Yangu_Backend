import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { PdfTicketService } from './pdf-ticket.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [EmailService, SmsService, PdfTicketService],
  exports: [EmailService, SmsService, PdfTicketService],
})
export class NotificationModule {}
