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
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Event not found');
    if (user.role !== 'admin' && event.organizer.id !== user.id)
      throw new ForbiddenException('Not allowed');
    return this.ticketRepository.find({ where: { event: { id: eventId } } });
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
}
