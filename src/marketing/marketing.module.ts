import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { NotificationModule } from '../notification/notification.module';
import { TicketModule } from '../ticket/ticket.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [NotificationModule, TicketModule, AuthModule, UserModule],
  controllers: [MarketingController],
})
export class MarketingModule {}
