import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { Event, EventStatus } from '../event/event.entity';
import { Ticket, TicketStatus } from '../ticket/ticket.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  async getDashboardOverview(): Promise<{
    totalUsers: number;
    totalEvents: number;
    totalTickets: number;
    totalRevenue: number;
    activeEvents: number;
    pendingEvents: number;
    monthlyGrowth: {
      users: number;
      events: number;
      tickets: number;
      revenue: number;
    };
    recentActivity: Array<{
      type: string;
      description: string;
      timestamp: Date;
    }>;
  }> {
    const [totalUsers, totalEvents, totalTickets] = await Promise.all([
      this.userRepository.count(),
      this.eventRepository.count(),
      this.ticketRepository.count(),
    ]);

    const tickets = await this.ticketRepository.find();
    const totalRevenue = tickets.reduce((sum, ticket) => sum + (Number(ticket.price) || 0), 0);

    const activeEvents = await this.eventRepository.count({
      where: { status: EventStatus.ACTIVE },
    });

    const pendingEvents = await this.eventRepository.count({
      where: { status: EventStatus.PENDING },
    });

    // Calculate monthly growth (current month vs previous month)
    const currentDate = new Date();
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);

    // For now, skip monthly growth calculations to avoid TypeORM query issues
    // This can be implemented later with proper TypeORM syntax
    const monthlyGrowth = {
      users: 0,
      events: 0,
      tickets: 0,
      revenue: 0,
    };



    // Get recent activity (simplified for now)
    const recentUsers = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const recentEvents = await this.eventRepository.find({
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const recentTickets = await this.ticketRepository.find({
      order: { createdAt: 'DESC' },
      take: 5,
      relations: ['event'],
    });

    const recentActivity = [
      ...recentUsers.map(user => ({
        type: 'user_registration',
        description: `New user registered: ${user.email}`,
        timestamp: user.createdAt,
      })),
      ...recentEvents.map(event => ({
        type: 'event_created',
        description: `New event created: ${event.title}`,
        timestamp: event.createdAt,
      })),
      ...recentTickets.map(ticket => ({
        type: 'ticket_purchased',
        description: `Ticket purchased for: ${ticket.event?.title || 'Unknown Event'}`,
        timestamp: ticket.createdAt,
      })),
    ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10);

    return {
      totalUsers,
      totalEvents,
      totalTickets,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      activeEvents,
      pendingEvents,
      monthlyGrowth,
      recentActivity,
    };
  }

  async getRevenueAnalytics(startDate?: string, endDate?: string): Promise<{
    totalRevenue: number;
    paidRevenue: number;
    refundedAmount: number;
    projectedRevenue: number;
    revenueByMonth: Array<{ month: string; revenue: number; tickets: number }>;
    revenueByEvent: Array<{
      eventId: number;
      eventTitle: string;
      revenue: number;
      ticketsSold: number;
      averageTicketPrice: number;
    }>;
    topPerformingEvents: Array<{
      eventId: number;
      eventTitle: string;
      revenue: number;
      ticketsSold: number;
    }>;
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

    // Simple projection based on current month performance
    const currentMonthRevenue = tickets
      .filter(ticket => {
        const ticketDate = new Date(ticket.createdAt);
        const currentDate = new Date();
        return ticketDate.getMonth() === currentDate.getMonth() && 
               ticketDate.getFullYear() === currentDate.getFullYear();
      })
      .reduce((sum, ticket) => sum + (Number(ticket.price) || 0), 0);

    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const projectedRevenue = Math.round((currentMonthRevenue / currentDay) * daysInMonth * 100) / 100;

    // Revenue by month
    const monthlyStats = tickets.reduce((acc, ticket) => {
      const month = ticket.createdAt.toISOString().substring(0, 7);
      if (!acc[month]) {
        acc[month] = { revenue: 0, tickets: 0 };
      }
      acc[month].revenue += Number(ticket.price) || 0;
      acc[month].tickets += 1;
      return acc;
    }, {} as Record<string, { revenue: number; tickets: number }>);

    const revenueByMonth = Object.entries(monthlyStats)
      .map(([month, stats]) => ({ month, ...stats }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Revenue by event
    const eventStats = tickets.reduce((acc, ticket) => {
      const eventId = ticket.event?.id || 0;
      const eventTitle = ticket.event?.title || 'Unknown Event';
      if (!acc[eventId]) {
        acc[eventId] = {
          eventId,
          eventTitle,
          revenue: 0,
          ticketsSold: 0,
        };
      }
      acc[eventId].revenue += Number(ticket.price) || 0;
      acc[eventId].ticketsSold += 1;
      return acc;
    }, {} as Record<number, any>);

    const revenueByEvent = Object.values(eventStats).map((event: any) => ({
      ...event,
      averageTicketPrice: event.ticketsSold > 0 ? 
        Math.round((event.revenue / event.ticketsSold) * 100) / 100 : 0,
    }));

    const topPerformingEvents = revenueByEvent
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      paidRevenue: Math.round(paidRevenue * 100) / 100,
      refundedAmount: Math.round(refundedAmount * 100) / 100,
      projectedRevenue,
      revenueByMonth,
      revenueByEvent,
      topPerformingEvents,
    };
  }

  async getUserAnalytics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    usersByRole: Record<string, number>;
    userRegistrationTrend: Array<{ month: string; count: number }>;
    topEventOrganizers: Array<{
      userId: number;
      name: string;
      email: string;
      eventsCreated: number;
      totalRevenue: number;
    }>;
    userEngagement: {
      averageEventsPerUser: number;
      averageTicketsPerUser: number;
    };
  }> {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({
      where: { isActive: true },
    });

    const users = await this.userRepository.find();
    const usersByRole = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // User registration trend
    const registrationStats = users.reduce((acc, user) => {
      const month = user.createdAt.toISOString().substring(0, 7);
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const userRegistrationTrend = Object.entries(registrationStats)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Top event organizers
    const events = await this.eventRepository.find({ relations: ['organizer'] });
    const tickets = await this.ticketRepository.find({ relations: ['event', 'event.organizer'] });

    const organizerStats = events.reduce((acc, event) => {
      const userId = event.organizer?.id;
      if (!userId) return acc;

      if (!acc[userId]) {
        acc[userId] = {
          userId,
          name: event.organizer.name,
          email: event.organizer.email,
          eventsCreated: 0,
          totalRevenue: 0,
        };
      }
      acc[userId].eventsCreated += 1;
      return acc;
    }, {} as Record<number, any>);

    // Add revenue data
    tickets.forEach(ticket => {
      const organizerId = ticket.event?.organizer?.id;
      if (organizerId && organizerStats[organizerId]) {
        organizerStats[organizerId].totalRevenue += Number(ticket.price) || 0;
      }
    });

    const topEventOrganizers = Object.values(organizerStats)
      .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
      .map((organizer: any) => ({
        ...organizer,
        totalRevenue: Math.round(organizer.totalRevenue * 100) / 100,
      }));

    // User engagement metrics
    const averageEventsPerUser = totalUsers > 0 ? events.length / totalUsers : 0;
    const averageTicketsPerUser = totalUsers > 0 ? tickets.length / totalUsers : 0;

    return {
      totalUsers,
      activeUsers,
      usersByRole,
      userRegistrationTrend,
      topEventOrganizers,
      userEngagement: {
        averageEventsPerUser: Math.round(averageEventsPerUser * 100) / 100,
        averageTicketsPerUser: Math.round(averageTicketsPerUser * 100) / 100,
      },
    };
  }

  private calculateGrowthPercentage(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100 * 100) / 100;
  }
}