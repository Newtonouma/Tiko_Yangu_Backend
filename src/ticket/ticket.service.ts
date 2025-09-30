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

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  async purchaseTicket(data: Partial<Ticket>): Promise<Ticket> {
    const eventId = typeof data.event === 'number'
      ? data.event
      : (data.event as any)?.id ?? undefined;
    if (!eventId) {
      throw new BadRequestException('Missing event id');
    }
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event || String(event.status) !== 'active') {
      throw new BadRequestException('Invalid event');
    }
    const ticket = this.ticketRepository.create({
      ...data,
      event: event,
      qrCode: uuidv4(),
      status: TicketStatus.VALID,
    });
    const savedTicket = await this.ticketRepository.save(ticket);
    // Send notifications
    if (savedTicket.buyerEmail) {
      await this.emailService.sendTicketConfirmation(savedTicket.buyerEmail, event.title, savedTicket.id);
    }
    if (savedTicket.buyerPhone) {
      await this.smsService.sendTicketConfirmation(savedTicket.buyerPhone, event.title, savedTicket.id);
    }
    return savedTicket;
  }

  async getTicket(id: number): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { id }, relations: ['event'] });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async listTicketsForEvent(eventId: number, user): Promise<Ticket[]> {
  const event = await this.eventRepository.findOne({ where: { id: eventId }, relations: ['organizer'] });
  if (!event) throw new NotFoundException('Event not found');
  if (user.role !== 'admin' && event.organizer.id !== user.id) throw new ForbiddenException('Not allowed');
  return this.ticketRepository.find({ where: { event: { id: eventId } } });
  }

  async cancelTicket(id: number, user): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { id }, relations: ['event'] });
    if (!ticket) throw new NotFoundException('Ticket not found');
    // Only admin or event organizer for the event can cancel
    if (user.role !== 'admin' && ticket.event.organizer.id !== user.id) throw new ForbiddenException('Not allowed');
    ticket.status = TicketStatus.CANCELED;
    return this.ticketRepository.save(ticket);
  }

  async useTicket(id: number, user): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { id }, relations: ['event'] });
    if (!ticket) throw new NotFoundException('Ticket not found');
    // Only admin or event organizer for the event can mark as used
    if (user.role !== 'admin' && ticket.event.organizer.id !== user.id) throw new ForbiddenException('Not allowed');
    ticket.status = TicketStatus.USED;
    return this.ticketRepository.save(ticket);
  }
}
