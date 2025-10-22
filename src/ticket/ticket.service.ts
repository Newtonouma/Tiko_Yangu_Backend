import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from './ticket.entity';
import { Event } from '../event/event.entity';
import { v4 as uuidv4 } from 'uuid';
import { EmailService } from '../notification/email.service';
import { SmsService } from '../notification/sms.service';
import { PdfTicketService } from '../notification/pdf-ticket.service';
import { MpesaService } from '../mpesa/mpesa.service';

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly pdfTicketService: PdfTicketService,
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

    // Save ticket as PENDING and link to payment identifiers
    const ticket = this.ticketRepository.create({
      ...data,
      price,
      event: event,
      qrCode: uuidv4(),
      status: TicketStatus.PENDING,
      paymentProvider: 'mpesa',
      mpesaMerchantRequestId: (mpesaRes && mpesaRes.MerchantRequestID) || null,
      mpesaCheckoutRequestId: (mpesaRes && mpesaRes.CheckoutRequestID) || null,
    });
    const savedTicket = await this.ticketRepository.save(ticket);

    // Do NOT send confirmations here; wait for payment callback
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
        organizer: event.organizer,
      });
      console.log(
        '🎫 Event organizer ID:',
        event.organizer?.id,
        'Type:',
        typeof event.organizer?.id,
      );
    } else {
      console.log('❌ Event not found for ID:', eventId);
    }

    if (!event) throw new NotFoundException('Event not found');

    // Convert both IDs to numbers for comparison
    const userIdNum = Number(user.id);
    const organizerIdNum = Number(event.organizer?.id);

    console.log(
      '🎫 Comparison: userIdNum=',
      userIdNum,
      'organizerIdNum=',
      organizerIdNum,
    );
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
      relations: ['event'], // Make sure we include event details
    });
    console.log('🎫 Tickets found:', tickets.length);
    console.log(
      '🎫 First ticket sample:',
      tickets[0]
        ? {
            id: tickets[0].id,
            event: tickets[0].event
              ? { id: tickets[0].event.id, title: tickets[0].event.title }
              : null,
            buyerName: tickets[0].buyerName,
          }
        : 'No tickets',
    );
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

  // Called by payment callbacks to finalize a ticket
  async finalizePaymentByCheckoutId(
    checkoutRequestId: string,
    success: boolean,
    extra?: any,
  ): Promise<Ticket | null> {
    if (!checkoutRequestId) return null;
    const ticket = await this.ticketRepository.findOne({
      where: { mpesaCheckoutRequestId: checkoutRequestId },
      relations: ['event'],
    });
    if (!ticket) return null;

    if (success) {
      ticket.status = TicketStatus.VALID;
      await this.ticketRepository.save(ticket);
      // Send ticket confirmation notifications
      try {
        // Generate PDF ticket
        let pdfBuffer: Buffer | undefined;
        if (ticket.event) {
          pdfBuffer = await this.pdfTicketService.generateTicketPdf({
            ticketId: ticket.id,
            qrCode: ticket.qrCode,
            buyerName: ticket.buyerName,
            buyerEmail: ticket.buyerEmail,
            buyerPhone: ticket.buyerPhone,
            eventTitle: ticket.event.title,
            eventVenue: ticket.event.venue,
            eventLocation: ticket.event.location,
            eventStartDate: ticket.event.startDate,
            eventStartTime: ticket.event.startTime,
            eventEndDate: ticket.event.endDate,
            eventEndTime: ticket.event.endTime,
            ticketType: ticket.ticketType,
            price: Number(ticket.price),
          });
        }

        if (ticket.buyerEmail) {
          await this.emailService.sendTicketConfirmation(
            ticket.buyerEmail,
            ticket.event?.title || 'Your Event',
            ticket.id,
            pdfBuffer,
            ticket.event
              ? {
                  venue: ticket.event.venue,
                  location: ticket.event.location,
                  startDate: ticket.event.startDate,
                  startTime: ticket.event.startTime,
                  endDate: ticket.event.endDate,
                  endTime: ticket.event.endTime,
                  ticketType: ticket.ticketType,
                  price: Number(ticket.price),
                  buyerName: ticket.buyerName,
                }
              : undefined,
          );
        }
        if (ticket.buyerPhone) {
          await this.smsService.sendTicketConfirmation(
            ticket.buyerPhone,
            ticket.event?.title || 'Your Event',
            ticket.id,
          );
        }
      } catch (notificationError) {
        this.logger.error(
          `Failed to send ticket confirmation after payment: ${notificationError instanceof Error ? notificationError.message : notificationError}`,
        );
      }
    } else {
      ticket.status = TicketStatus.CANCELED;
      await this.ticketRepository.save(ticket);
    }

    return ticket;
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

    const byStatus = tickets.reduce(
      (acc, ticket) => {
        acc[ticket.status] = (acc[ticket.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const revenue = tickets.reduce(
      (acc, ticket) => {
        acc.total += Number(ticket.price) || 0;
        if (
          ticket.status === TicketStatus.VALID ||
          ticket.status === TicketStatus.USED
        ) {
          acc.paid += Number(ticket.price) || 0;
        }
        if (ticket.status === TicketStatus.REFUNDED) {
          acc.refunded += Number(ticket.price) || 0;
        }
        return acc;
      },
      { total: 0, paid: 0, refunded: 0 },
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
    const totalRevenue = tickets.reduce(
      (sum, ticket) => sum + (Number(ticket.price) || 0),
      0,
    );
    const averageTicketPrice =
      totalTickets > 0 ? totalRevenue / totalTickets : 0;

    const ticketsByStatus = tickets.reduce(
      (acc, ticket) => {
        acc[ticket.status] = (acc[ticket.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const ticketsByMonth = tickets.reduce(
      (acc, ticket) => {
        const month = ticket.createdAt
          ? ticket.createdAt.toISOString().substring(0, 7)
          : 'unknown';
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const eventStats = tickets.reduce(
      (acc, ticket) => {
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
      },
      {} as Record<number, any>,
    );

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

  async getRevenueReport(
    startDate?: string,
    endDate?: string,
  ): Promise<{
    totalRevenue: number;
    paidRevenue: number;
    refundedAmount: number;
    ticketsSold: number;
    period: { start: string; end: string };
    dailyRevenue: Array<{ date: string; revenue: number; tickets: number }>;
  }> {
    const query = this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.event', 'event');

    if (startDate) {
      query.andWhere('ticket.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('ticket.createdAt <= :endDate', { endDate });
    }

    const tickets = await query.getMany();

    const totalRevenue = tickets.reduce(
      (sum, ticket) => sum + (Number(ticket.price) || 0),
      0,
    );
    const paidRevenue = tickets
      .filter(
        (ticket) =>
          ticket.status === TicketStatus.VALID ||
          ticket.status === TicketStatus.USED,
      )
      .reduce((sum, ticket) => sum + (Number(ticket.price) || 0), 0);
    const refundedAmount = tickets
      .filter((ticket) => ticket.status === TicketStatus.REFUNDED)
      .reduce((sum, ticket) => sum + (Number(ticket.price) || 0), 0);

    const dailyStats = tickets.reduce(
      (acc, ticket) => {
        const date = ticket.createdAt
          ? ticket.createdAt.toISOString().split('T')[0]
          : 'unknown';
        if (!acc[date]) {
          acc[date] = { revenue: 0, tickets: 0 };
        }
        acc[date].revenue += Number(ticket.price) || 0;
        acc[date].tickets += 1;
        return acc;
      },
      {} as Record<string, { revenue: number; tickets: number }>,
    );

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

  async refundTicket(
    ticketId: number,
    reason: string,
    adminUser: any,
  ): Promise<Ticket> {
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
        `Your ticket for ${ticket.event?.title} has been refunded. Reason: ${reason}`,
      );
    }

    return savedTicket;
  }

  async updateTicketStatus(
    ticketId: number,
    status: TicketStatus,
    adminUser: any,
  ): Promise<Ticket> {
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
    const query = this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.event', 'event')
      .leftJoinAndSelect('event.organizer', 'organizer');

    if (searchParams.eventId) {
      query.andWhere('ticket.eventId = :eventId', {
        eventId: searchParams.eventId,
      });
    }

    if (searchParams.buyerEmail) {
      query.andWhere('ticket.buyerEmail ILIKE :buyerEmail', {
        buyerEmail: `%${searchParams.buyerEmail}%`,
      });
    }

    if (searchParams.buyerName) {
      query.andWhere('ticket.buyerName ILIKE :buyerName', {
        buyerName: `%${searchParams.buyerName}%`,
      });
    }

    if (searchParams.status) {
      query.andWhere('ticket.status = :status', {
        status: searchParams.status,
      });
    }

    if (searchParams.startDate) {
      query.andWhere('ticket.createdAt >= :startDate', {
        startDate: searchParams.startDate,
      });
    }

    if (searchParams.endDate) {
      query.andWhere('ticket.createdAt <= :endDate', {
        endDate: searchParams.endDate,
      });
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

  async getCustomersByEventAndIds(
    eventId: number,
    customerIds: number[],
    organizerId: number,
  ): Promise<Ticket[]> {
    // First verify the organizer owns this event
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.organizer.id !== organizerId) {
      throw new ForbiddenException('Not authorized to access this event');
    }

    // Get tickets for the specified customers and event
    const query = this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.event', 'event')
      .where('ticket.eventId = :eventId', { eventId });

    if (customerIds.length > 0) {
      query.andWhere('ticket.id IN (:...customerIds)', { customerIds });
    }

    const tickets = await query.getMany();
    return tickets;
  }

  async getTicketsForOrganizer(organizerId: number): Promise<Ticket[]> {
    const query = this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.event', 'event')
      .leftJoinAndSelect('event.organizer', 'organizer')
      .where('event.organizerId = :organizerId', { organizerId });

    const tickets = await query.getMany();
    return tickets;
  }

  async getAllTicketsForBroadcast(): Promise<Ticket[]> {
    const tickets = await this.ticketRepository.find({
      relations: ['event', 'event.organizer'],
    });
    return tickets;
  }

  async getTicketsForEvent(eventId: number): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { event: { id: eventId } },
      relations: ['event'],
    });
  }

  async getEventsWithCustomerCounts(): Promise<any[]> {
    const events = await this.eventRepository
      .createQueryBuilder('event')
      .leftJoin('event.tickets', 'ticket')
      .select(['event.id', 'event.title', 'event.venue', 'event.startDate'])
      .addSelect('COUNT(DISTINCT ticket.buyerEmail)', 'customerCount')
      .groupBy('event.id')
      .getRawAndEntities();

    return events.entities.map((event, index) => ({
      ...event,
      customerCount: parseInt(events.raw[index].customerCount) || 0,
    }));
  }

  async getUniqueCustomersCount(): Promise<number> {
    const result = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('COUNT(DISTINCT ticket.buyerEmail)', 'count')
      .where('ticket.buyerEmail IS NOT NULL')
      .getRawOne();

    return parseInt(result.count) || 0;
  }
}
