import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './ticket.entity';
import { Event } from '../event/event.entity';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from '../auth/auth.module';
import { MpesaModule } from '../mpesa/mpesa.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, Event]),
    NotificationModule,
    AuthModule,
    forwardRef(() => MpesaModule),
  ],
  providers: [TicketService],
  controllers: [TicketController],
  exports: [TicketService],
})
export class TicketModule {}
