import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus } from './event.entity';
import { User } from '../user/user.entity';
import { Ticket } from '../ticket/ticket.entity';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  async listEventsByOrganizer(organizerId: number): Promise<any[]> {
    const events = await this.eventRepository.find({
      where: { organizer: { id: organizerId } },
      relations: ['organizer'],
    });
    return events.map((event) => ({
      ...event,
      images: event.images || [],
      organizer: event.organizer
        ? { id: event.organizer.id, role: event.organizer.role }
        : null,
    }));
  }

  async getEventByOrganizer(
    organizerId: number,
    eventId: number,
  ): Promise<any> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId, organizer: { id: organizerId } },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Event not found');
    if (!event.images) event.images = [];
    return {
      ...event,
      organizer: event.organizer
        ? { id: event.organizer.id, role: event.organizer.role }
        : null,
    };
  }

  async createEvent(data: Partial<Event>, organizer: User): Promise<any> {
    const event = this.eventRepository.create({
      ...data,
      organizer,
      status: EventStatus.ACTIVE,
    });
    const saved = await this.eventRepository.save(event);
    if (!saved.images) saved.images = [];
    return {
      ...saved,
      organizer: {
        id: organizer.id,
        role: organizer.role,
      },
    };
  }

  async updateEvent(
    id: number,
    data: Partial<Event>,
    user: User,
  ): Promise<any> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Event not found');
    if (user.role !== 'admin') {
      if (!event.organizer || !event.organizer.id) {
        throw new ForbiddenException('Event organizer missing or invalid');
      }
      if (event.organizer.id !== user.id) {
        throw new ForbiddenException('Not allowed');
      }
    }
    Object.assign(event, data);
    const saved = await this.eventRepository.save(event);
    if (!saved.images) saved.images = [];
    return {
      ...saved,
      organizer: {
        id: event.organizer.id,
        role: event.organizer.role,
      },
    };
  }

  async deleteEvent(id: number, user: User): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Event not found');
    if (user.role !== 'admin' && event.organizer.id !== user.id)
      throw new ForbiddenException('Not allowed');
    event.status = EventStatus.DELETED;
    return this.eventRepository.save(event);
  }

  async archiveEvent(id: number, user: User): Promise<Event> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Event not found');
    if (user.role !== 'admin' && event.organizer.id !== user.id)
      throw new ForbiddenException('Not allowed');
    event.status = EventStatus.ARCHIVED;
    return this.eventRepository.save(event);
  }

  async getEvent(id: number): Promise<any> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Event not found');
    if (!event.images) event.images = [];
    return {
      ...event,
      organizer: event.organizer
        ? { id: event.organizer.id, role: event.organizer.role }
        : null,
    };
  }

  async listActiveEvents(): Promise<any[]> {
    const events = await this.eventRepository.find({
      where: { status: EventStatus.ACTIVE },
      relations: ['organizer'],
    });
    return events.map((event) => ({
      ...event,
      images: event.images || [],
      organizer: event.organizer
        ? { id: event.organizer.id, role: event.organizer.role }
        : null,
    }));
  }

  async listArchivedEvents(): Promise<any[]> {
    const events = await this.eventRepository.find({
      where: { status: EventStatus.ARCHIVED },
      relations: ['organizer'],
    });
    return events.map((event) => ({
      ...event,
      images: event.images || [],
      organizer: event.organizer
        ? { id: event.organizer.id, role: event.organizer.role }
        : null,
    }));
  }

  // Admin-specific methods
  async getAllEventsForAdmin(): Promise<any[]> {
    const events = await this.eventRepository.find({
      relations: ['organizer'],
      order: { createdAt: 'DESC' }
    });

    // Get ticket sales data for all events
    const eventIds = events.map((event) => event.id);
    const tickets = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.event', 'event')
      .where('ticket.eventId IN (:...eventIds)', { eventIds })
      .getMany();

    // Calculate sales data for each event
    const eventSalesMap = tickets.reduce(
      (acc, ticket) => {
        const eventId = ticket.event.id;
        if (!acc[eventId]) {
          acc[eventId] = { ticketsSold: 0, revenue: 0 };
        }
        acc[eventId].ticketsSold += 1;
        acc[eventId].revenue += Number(ticket.price) || 0;
        return acc;
      },
      {} as Record<number, { ticketsSold: number; revenue: number }>,
    );

    return events.map((event) => ({
      ...event,
      images: event.images || [],
      organizer: event.organizer
        ? { id: event.organizer.id, name: event.organizer.name, email: event.organizer.email }
        : null,
      ticketsSold: eventSalesMap[event.id]?.ticketsSold || 0,
      revenue: eventSalesMap[event.id]?.revenue || 0,
    }));
  }

  async getEventStatistics(): Promise<{
    totalEvents: number;
    activeEvents: number;
    pendingEvents: number;
    archivedEvents: number;
    featuredEvents: number;
    totalRevenue: number;
    recentEvents: any[];
  }> {
    const totalEvents = await this.eventRepository.count();
    const activeEvents = await this.eventRepository.count({ 
      where: { status: EventStatus.ACTIVE } 
    });
    const pendingEvents = await this.eventRepository.count({ 
      where: { status: EventStatus.PENDING } 
    });
    const archivedEvents = await this.eventRepository.count({ 
      where: { status: EventStatus.ARCHIVED } 
    });
    const featuredEvents = await this.eventRepository.count({ 
      where: { isFeatured: true } 
    });

    // Calculate total revenue (this would need integration with ticket sales)
    const totalRevenue = 0; // TODO: Implement based on ticket sales

    const recentEvents = await this.eventRepository.find({
      relations: ['organizer'],
      order: { createdAt: 'DESC' },
      take: 10
    });

    return {
      totalEvents,
      activeEvents,
      pendingEvents,
      archivedEvents,
      featuredEvents,
      totalRevenue,
      recentEvents: recentEvents.map(event => ({
        ...event,
        images: event.images || [],
        organizer: event.organizer 
          ? { id: event.organizer.id, name: event.organizer.name }
          : null
      }))
    };
  }

  async getPendingEvents(): Promise<any[]> {
    const events = await this.eventRepository.find({
      where: { status: EventStatus.PENDING },
      relations: ['organizer'],
      order: { createdAt: 'ASC' }
    });
    return events.map((event) => ({
      ...event,
      images: event.images || [],
      organizer: event.organizer
        ? { id: event.organizer.id, name: event.organizer.name, email: event.organizer.email }
        : null,
    }));
  }

  async approveEvent(id: number, user: any): Promise<any> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Event not found');
    
    event.status = EventStatus.APPROVED;
    event.approvedBy = user.id;
    event.approvedAt = new Date();
    
    return this.eventRepository.save(event);
  }

  async rejectEvent(id: number, reason: string, user: any): Promise<any> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Event not found');
    
    event.status = EventStatus.REJECTED;
    event.rejectionReason = reason;
    
    return this.eventRepository.save(event);
  }

  async featureEvent(id: number, user: any): Promise<any> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Event not found');
    
    event.isFeatured = true;
    
    return this.eventRepository.save(event);
  }

  async unfeatureEvent(id: number, user: any): Promise<any> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Event not found');
    
    event.isFeatured = false;
    
    return this.eventRepository.save(event);
  }

  async deleteEventAsAdmin(id: number, user: any): Promise<{ message: string }> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Event not found');
    
    // Soft delete by changing status
    event.status = EventStatus.DELETED;
    await this.eventRepository.save(event);
    
    return { message: 'Event deleted successfully' };
  }
}
