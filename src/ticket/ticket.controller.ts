import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketStatus } from './ticket.entity';
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
  @UseGuards(JwtAuthGuard)
  async listTicketsForEvent(@Param('eventId') eventId: number, @Request() req) {
    return this.ticketService.listTicketsForEvent(eventId, req.user);
  }

  @Get('organizer/my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('event_organizer')
  async getMyTickets(@Request() req) {
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException('User ID not found');
    }
    return this.ticketService.getTicketsForOrganizer(Number(userId));
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

  // Admin-specific ticket management endpoints
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getAllTicketsForAdmin() {
    return await this.ticketService.getAllTicketsForAdmin();
  }

  @Get('admin/statistics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getTicketStatistics() {
    return await this.ticketService.getTicketStatisticsForAdmin();
  }

  @Get('admin/revenue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getRevenueReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.ticketService.getRevenueReport(startDate, endDate);
  }

  @Put('admin/:id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async refundTicket(
    @Param('id') id: number,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    return await this.ticketService.refundTicket(id, body.reason, req.user);
  }

  @Put('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateTicketStatus(
    @Param('id') id: number,
    @Body() body: { status: TicketStatus },
    @Request() req,
  ) {
    return await this.ticketService.updateTicketStatus(
      id,
      body.status,
      req.user,
    );
  }

  @Get('admin/search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async searchTickets(
    @Query('eventId') eventId?: number,
    @Query('buyerEmail') buyerEmail?: string,
    @Query('buyerName') buyerName?: string,
    @Query('status') status?: TicketStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return await this.ticketService.searchTickets({
      eventId,
      buyerEmail,
      buyerName,
      status,
      startDate,
      endDate,
      limit,
      offset,
    });
  }
}
