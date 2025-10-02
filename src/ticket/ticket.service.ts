import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from './ticket.entity';
import { Event } from '../event/event.entity';
import { v4 as uuidv4 } from 'uuid';
import { EmailService } from '../notification/email.service';
import { SmsService } from '../notification/sms.service';
import { MpesaService } from '../mpesa/mpesa.service';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly mpesaService: MpesaService,
  ) {}

  async purchaseTicket(data: Partial<Ticket>): Promise<any> {
    const eventId =
      typeof data.event === 'number'
        ? data.event
        : ((data.event as any)?.id ?? undefined);
    if (!eventId) {
      throw new BadRequestException('Missing event id');
    }
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event || String(event.status) !== 'active') {
      throw new BadRequestException('Invalid event');
    }
    // Initiate Mpesa payment
    if (!data.buyerPhone || !data.buyerName) {
      throw new BadRequestException(
        'buyerPhone and buyerName are required for payment',
      );
    }
    const price =
      typeof data.price === 'number' ? data.price : Number(data.price);
    if (isNaN(price)) {
      throw new BadRequestException('price is required and must be a number');
    }
    const mpesaRes = await this.mpesaService.stkPush({
      amount: price,
      phone: data.buyerPhone,
      accountReference: event.title || 'Ticket',
      transactionDesc: `Ticket for ${event.title}`,
    });
    // For now, save as VALID (or you can add a new status if you want to track pending payments)
    const ticket = this.ticketRepository.create({
      ...data,
      price,
      event: event,
      qrCode: uuidv4(),
      status: TicketStatus.VALID,
    });
    const savedTicket = await this.ticketRepository.save(ticket);
    // Send notifications (optional, after payment confirmation)
    return {
      ticket: savedTicket,
      mpesa: mpesaRes,
    };
  }

  async getTicket(id: number): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: ['event'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async listTicketsForEvent(eventId: number, user): Promise<Ticket[]> {
    console.log('🎫 Backend: listTicketsForEvent called');
    console.log('🎫 EventId:', eventId, 'Type:', typeof eventId);
    console.log('🎫 User:', user);
    console.log('🎫 User ID:', user.id, 'Type:', typeof user.id);
    console.log('🎫 User Role:', user.role);
    
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });
    
    console.log('🎫 Event found:', !!event);
    if (event) {
      console.log('🎫 Event details:', {
        id: event.id,
        title: event.title,
        organizer: event.organizer
      });
      console.log('🎫 Event organizer ID:', event.organizer?.id, 'Type:', typeof event.organizer?.id);
    } else {
      console.log('❌ Event not found for ID:', eventId);
    }
    
    if (!event) throw new NotFoundException('Event not found');
    
    // Convert both IDs to numbers for comparison
    const userIdNum = Number(user.id);
    const organizerIdNum = Number(event.organizer?.id);
    
    console.log('🎫 Comparison: userIdNum=', userIdNum, 'organizerIdNum=', organizerIdNum);
    console.log('🎫 Are they equal?', userIdNum === organizerIdNum);
    console.log('🎫 Is admin?', user.role === 'admin');
    
    // Temporarily disable authorization check for debugging
    // if (user.role !== 'admin' && organizerIdNum !== userIdNum) {
    //   console.log('❌ Access denied: Not admin and not organizer');
    //   throw new ForbiddenException('Not allowed');
    // }
    if (user.role !== 'admin' && organizerIdNum !== userIdNum) {
      console.log('❌ Access denied: Not admin and not organizer');
      throw new ForbiddenException('Not allowed');
    }
    console.log('✅ Authorization passed');
    
    const tickets = await this.ticketRepository.find({ 
      where: { event: { id: eventId } },
      relations: ['event'] // Make sure we include event details
    });
    console.log('🎫 Tickets found:', tickets.length);
    console.log('🎫 First ticket sample:', tickets[0] ? {
      id: tickets[0].id,
      event: tickets[0].event ? { id: tickets[0].event.id, title: tickets[0].event.title } : null,
      buyerName: tickets[0].buyerName
    } : 'No tickets');
    return tickets;
  }

  async cancelTicket(id: number, user): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: ['event'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    // Only admin or event organizer for the event can cancel
    if (user.role !== 'admin' && ticket.event.organizer.id !== user.id)
      throw new ForbiddenException('Not allowed');
    ticket.status = TicketStatus.CANCELED;
    return this.ticketRepository.save(ticket);
  }

  async useTicket(id: number, user): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: ['event'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    // Only admin or event organizer for the event can mark as used
    if (user.role !== 'admin' && ticket.event.organizer.id !== user.id)
      throw new ForbiddenException('Not allowed');
    ticket.status = TicketStatus.USED;
    return this.ticketRepository.save(ticket);
  }

  // Admin-specific methods
  async getAllTicketsForAdmin(): Promise<{
    tickets: Ticket[];
    total: number;
    byStatus: Record<string, number>;
    revenue: {
      total: number;
      paid: number;
      refunded: number;
    };
  }> {
    const tickets = await this.ticketRepository.find({
      relations: ['event', 'event.organizer'],
      order: { createdAt: 'DESC' },
    });

    const byStatus = tickets.reduce((acc, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const revenue = tickets.reduce(
      (acc, ticket) => {
        acc.total += Number(ticket.price) || 0;
        if (ticket.status === TicketStatus.VALID || ticket.status === TicketStatus.USED) {
          acc.paid += Number(ticket.price) || 0;
        }
        if (ticket.status === TicketStatus.REFUNDED) {
          acc.refunded += Number(ticket.price) || 0;
        }
        return acc;
      },
      { total: 0, paid: 0, refunded: 0 }
    );

    return {
      tickets,
      total: tickets.length,
      byStatus,
      revenue,
    };
  }

  async getTicketStatisticsForAdmin(): Promise<{
    totalTickets: number;
    totalRevenue: number;
    ticketsByStatus: Record<string, number>;
    ticketsByMonth: Record<string, number>;
    averageTicketPrice: number;
    topEvents: Array<{
      eventId: number;
      eventTitle: string;
      ticketsSold: number;
      revenue: number;
    }>;
  }> {
    const tickets = await this.ticketRepository.find({
      relations: ['event'],
    });

    const totalTickets = tickets.length;
    const totalRevenue = tickets.reduce((sum, ticket) => sum + (Number(ticket.price) || 0), 0);
    const averageTicketPrice = totalTickets > 0 ? totalRevenue / totalTickets : 0;

    const ticketsByStatus = tickets.reduce((acc, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const ticketsByMonth = tickets.reduce((acc, ticket) => {
      const month = ticket.createdAt ? ticket.createdAt.toISOString().substring(0, 7) : 'unknown';
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const eventStats = tickets.reduce((acc, ticket) => {
      const eventId = ticket.event?.id || 0;
      const eventTitle = ticket.event?.title || 'Unknown Event';
      if (!acc[eventId]) {
        acc[eventId] = {
          eventId,
          eventTitle,
          ticketsSold: 0,
          revenue: 0,
        };
      }
      acc[eventId].ticketsSold += 1;
      acc[eventId].revenue += Number(ticket.price) || 0;
      return acc;
    }, {} as Record<number, any>);

    const topEvents = Object.values(eventStats)
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalTickets,
      totalRevenue,
      ticketsByStatus,
      ticketsByMonth,
      averageTicketPrice: Math.round(averageTicketPrice * 100) / 100,
      topEvents,
    };
  }

  async getRevenueReport(startDate?: string, endDate?: string): Promise<{
    totalRevenue: number;
    paidRevenue: number;
    refundedAmount: number;
    ticketsSold: number;
    period: { start: string; end: string };
    dailyRevenue: Array<{ date: string; revenue: number; tickets: number }>;
  }> {
    const query = this.ticketRepository.createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.event', 'event');

    if (startDate) {
      query.andWhere('ticket.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('ticket.createdAt <= :endDate', { endDate });
    }

    const tickets = await query.getMany();

    const totalRevenue = tickets.reduce((sum, ticket) => sum + (Number(ticket.price) || 0), 0);
    const paidRevenue = tickets
      .filter(ticket => ticket.status === TicketStatus.VALID || ticket.status === TicketStatus.USED)
      .reduce((sum, ticket) => sum + (Number(ticket.price) || 0), 0);
    const refundedAmount = tickets
      .filter(ticket => ticket.status === TicketStatus.REFUNDED)
      .reduce((sum, ticket) => sum + (Number(ticket.price) || 0), 0);

    const dailyStats = tickets.reduce((acc, ticket) => {
      const date = ticket.createdAt ? ticket.createdAt.toISOString().split('T')[0] : 'unknown';
      if (!acc[date]) {
        acc[date] = { revenue: 0, tickets: 0 };
      }
      acc[date].revenue += Number(ticket.price) || 0;
      acc[date].tickets += 1;
      return acc;
    }, {} as Record<string, { revenue: number; tickets: number }>);

    const dailyRevenue = Object.entries(dailyStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalRevenue,
      paidRevenue,
      refundedAmount,
      ticketsSold: tickets.length,
      period: {
        start: startDate || 'all-time',
        end: endDate || 'now',
      },
      dailyRevenue,
    };
  }

  async refundTicket(ticketId: number, reason: string, adminUser: any): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: ['event'],
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.status === TicketStatus.REFUNDED) {
      throw new BadRequestException('Ticket already refunded');
    }

    if (ticket.status === TicketStatus.USED) {
      throw new BadRequestException('Cannot refund used ticket');
    }

    ticket.status = TicketStatus.REFUNDED;
    ticket.refundReason = reason;
    ticket.refundedAt = new Date();
    ticket.refundedBy = adminUser.id;

    const savedTicket = await this.ticketRepository.save(ticket);

    // Send refund notification email
    if (ticket.buyerEmail) {
      await this.emailService.sendEmail(
        ticket.buyerEmail,
        'Ticket Refunded',
        `Your ticket for ${ticket.event?.title} has been refunded. Reason: ${reason}`
      );
    }

    return savedTicket;
  }

  async updateTicketStatus(ticketId: number, status: TicketStatus, adminUser: any): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: ['event'],
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const oldStatus = ticket.status;
    ticket.status = status;

    // Add audit trail
    ticket.lastModifiedBy = adminUser.id;
    ticket.lastModifiedAt = new Date();

    const savedTicket = await this.ticketRepository.save(ticket);

    // Send notification if status changed significantly
    if (oldStatus !== status && ticket.buyerEmail) {
      let subject = 'Ticket Status Updated';
      let message = `Your ticket for ${ticket.event?.title} status has been updated to: ${status}`;
      
      if (status === TicketStatus.CANCELED) {
        subject = 'Ticket Canceled';
        message = `Your ticket for ${ticket.event?.title} has been canceled.`;
      } else if (status === TicketStatus.USED) {
        subject = 'Ticket Used';
        message = `Your ticket for ${ticket.event?.title} has been used.`;
      }

      await this.emailService.sendEmail(ticket.buyerEmail, subject, message);
    }

    return savedTicket;
  }

  async searchTickets(searchParams: {
    eventId?: number;
    buyerEmail?: string;
    buyerName?: string;
    status?: TicketStatus;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    tickets: Ticket[];
    total: number;
  }> {
    const query = this.ticketRepository.createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.event', 'event')
      .leftJoinAndSelect('event.organizer', 'organizer');

    if (searchParams.eventId) {
      query.andWhere('ticket.eventId = :eventId', { eventId: searchParams.eventId });
    }

    if (searchParams.buyerEmail) {
      query.andWhere('ticket.buyerEmail ILIKE :buyerEmail', { 
        buyerEmail: `%${searchParams.buyerEmail}%` 
      });
    }

    if (searchParams.buyerName) {
      query.andWhere('ticket.buyerName ILIKE :buyerName', { 
        buyerName: `%${searchParams.buyerName}%` 
      });
    }

    if (searchParams.status) {
      query.andWhere('ticket.status = :status', { status: searchParams.status });
    }

    if (searchParams.startDate) {
      query.andWhere('ticket.createdAt >= :startDate', { startDate: searchParams.startDate });
    }

    if (searchParams.endDate) {
      query.andWhere('ticket.createdAt <= :endDate', { endDate: searchParams.endDate });
    }

    query.orderBy('ticket.createdAt', 'DESC');

    if (searchParams.limit) {
      query.limit(searchParams.limit);
    }

    if (searchParams.offset) {
      query.offset(searchParams.offset);
    }

    const [tickets, total] = await query.getManyAndCount();

    return {
      tickets,
      total,
    };
  }
}
