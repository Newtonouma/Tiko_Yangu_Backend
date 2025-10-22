import { Module, forwardRef } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { MpesaController } from './mpesa.controller';
import { TicketModule } from '../ticket/ticket.module';

@Module({
  imports: [forwardRef(() => TicketModule)],
  providers: [MpesaService],
  controllers: [MpesaController],
  exports: [MpesaService],
})
export class MpesaModule {}
