import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus } from './event.entity';
import { User } from '../user/user.entity';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  async createEvent(data: Partial<Event>, organizer: User): Promise<any> {
    const event = this.eventRepository.create({ ...data, organizer, status: EventStatus.ACTIVE });
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

  async updateEvent(id: number, data: Partial<Event>, user: User): Promise<any> {
    const event = await this.eventRepository.findOne({ where: { id }, relations: ['organizer'] });
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
    const event = await this.eventRepository.findOne({ where: { id }, relations: ['organizer'] });
    if (!event) throw new NotFoundException('Event not found');
    if (user.role !== 'admin' && event.organizer.id !== user.id) throw new ForbiddenException('Not allowed');
    event.status = EventStatus.DELETED;
    return this.eventRepository.save(event);
  }

  async archiveEvent(id: number, user: User): Promise<Event> {
    const event = await this.eventRepository.findOne({ where: { id }, relations: ['organizer'] });
    if (!event) throw new NotFoundException('Event not found');
    if (user.role !== 'admin' && event.organizer.id !== user.id) throw new ForbiddenException('Not allowed');
    event.status = EventStatus.ARCHIVED;
    return this.eventRepository.save(event);
  }

  async getEvent(id: number): Promise<any> {
    const event = await this.eventRepository.findOne({ where: { id }, relations: ['organizer'] });
    if (!event) throw new NotFoundException('Event not found');
    if (!event.images) event.images = [];
    return {
      ...event,
      organizer: event.organizer ? { id: event.organizer.id, role: event.organizer.role } : null,
    };
  }

  async listActiveEvents(): Promise<any[]> {
    const events = await this.eventRepository.find({ where: { status: EventStatus.ACTIVE }, relations: ['organizer'] });
    return events.map(event => ({
      ...event,
      images: event.images || [],
      organizer: event.organizer ? { id: event.organizer.id, role: event.organizer.role } : null,
    }));
  }

  async listArchivedEvents(): Promise<any[]> {
    const events = await this.eventRepository.find({ where: { status: EventStatus.ARCHIVED }, relations: ['organizer'] });
    return events.map(event => ({
      ...event,
      images: event.images || [],
      organizer: event.organizer ? { id: event.organizer.id, role: event.organizer.role } : null,
    }));
  }
}
