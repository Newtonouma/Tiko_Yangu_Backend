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
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post('purchase')
  async purchase(@Body() data: Partial<Ticket>) {
    // Allow anyone to purchase tickets (unauthenticated)
    // buyerName, buyerEmail, buyerPhone must be provided in the request body
    return this.ticketService.purchaseTicket(data);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getTicket(@Param('id') id: number, @Request() req) {
    const ticket = await this.ticketService.getTicket(id);
    if (ticket.buyerEmail !== req.user.email && req.user.role !== 'admin') {
      throw new ForbiddenException('Not allowed');
    }
    return ticket;
  }

  @Get('event/:eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  async listTicketsForEvent(@Param('eventId') eventId: number, @Request() req) {
    return this.ticketService.listTicketsForEvent(eventId, req.user);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  async cancel(@Param('id') id: number, @Request() req) {
    return this.ticketService.cancelTicket(id, req.user);
  }

  @Post(':id/use')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  async use(@Param('id') id: number, @Request() req) {
    return this.ticketService.useTicket(id, req.user);
  }
}
