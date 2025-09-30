import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Ticket } from './ticket.entity';

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post('purchase')
  @Roles('user', 'admin')
  async purchase(@Body() data: Partial<Ticket>, @Request() req) {
    // Only users can purchase tickets
    // Optionally, you can set buyerName, buyerEmail, buyerPhone from req.user if needed
    return this.ticketService.purchaseTicket({
      ...data,
      buyerName: req.user.name,
      buyerEmail: req.user.email,
      buyerPhone: req.user.phone,
    });
  }

  @Get(':id')
  async getTicket(@Param('id') id: number, @Request() req) {
    const ticket = await this.ticketService.getTicket(id);
    if (ticket.buyerEmail !== req.user.email && req.user.role !== 'admin') {
      throw new ForbiddenException('Not allowed');
    }
    return ticket;
  }

  @Get('event/:eventId')
  @Roles('admin', 'organizer')
  async listTicketsForEvent(@Param('eventId') eventId: number, @Request() req) {
    return this.ticketService.listTicketsForEvent(eventId, req.user);
  }

  @Post(':id/cancel')
  @Roles('admin', 'organizer')
  async cancel(@Param('id') id: number, @Request() req) {
    return this.ticketService.cancelTicket(id, req.user);
  }

  @Post(':id/use')
  @Roles('admin', 'organizer')
  async use(@Param('id') id: number, @Request() req) {
    return this.ticketService.useTicket(id, req.user);
  }
}
