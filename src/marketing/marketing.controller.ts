import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EmailService } from '../notification/email.service';
import { SmsService } from '../notification/sms.service';
import { TicketService } from '../ticket/ticket.service';
import { UserService } from '../user/user.service';

interface SendMarketingMessageDto {
  eventId: number;
  customerIds: number[];
  messageType: 'email' | 'sms';
  subject?: string;
  message: string;
}

interface SendBroadcastMessageDto {
  messageType: 'email' | 'sms';
  subject?: string;
  message: string;
  customerIds?: number[]; // Optional: specific customers, if empty sends to all
}

interface AdminBroadcastDto {
  messageType: 'email' | 'sms';
  subject?: string;
  message: string;
  targetType:
    | 'all_users'
    | 'organizers'
    | 'customers'
    | 'customers_by_event'
    | 'customers_by_organizer';
  targetId?: number; // Event ID or Organizer ID when needed
  userIds?: number[]; // Specific user IDs if targeting specific users
}

interface MarketingResult {
  customer: string;
  status: 'sent' | 'failed';
  method?: 'email' | 'sms';
  reason?: string;
}

@Controller('marketing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MarketingController {
  constructor(
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly ticketService: TicketService,
    private readonly userService: UserService,
  ) {}

  @Post('send')
  @Roles('event_organizer', 'admin')
  async sendMarketingMessage(
    @Body() dto: SendMarketingMessageDto,
    @Request() req: any,
  ) {
    try {
      const { eventId, customerIds, messageType, subject, message } = dto;

      // Get customers for the specific event and organizer
      const customers = await this.ticketService.getCustomersByEventAndIds(
        eventId,
        customerIds,
        req.user.id,
      );

      if (customers.length === 0) {
        throw new HttpException(
          'No customers found for this event',
          HttpStatus.NOT_FOUND,
        );
      }

      const results: MarketingResult[] = [];

      for (const customer of customers) {
        try {
          if (messageType === 'email') {
            if (!customer.buyerEmail) {
              results.push({
                customer: customer.buyerName,
                status: 'failed',
                reason: 'No email address',
              });
              continue;
            }
            await this.emailService.sendEmail(
              customer.buyerEmail,
              subject || 'Message from Event Organizer',
              message,
            );
            results.push({
              customer: customer.buyerName,
              status: 'sent',
              method: 'email',
            });
          } else if (messageType === 'sms') {
            if (!customer.buyerPhone) {
              results.push({
                customer: customer.buyerName,
                status: 'failed',
                reason: 'No phone number',
              });
              continue;
            }
            await this.smsService.sendMarketingMessage(
              customer.buyerPhone,
              message,
            );
            results.push({
              customer: customer.buyerName,
              status: 'sent',
              method: 'sms',
            });
          }
        } catch (error) {
          results.push({
            customer: customer.buyerName,
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        message: 'Marketing messages processed',
        results,
        summary: {
          total: customers.length,
          sent: results.filter((r) => r.status === 'sent').length,
          failed: results.filter((r) => r.status === 'failed').length,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Failed to send marketing messages: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('broadcast')
  @Roles('event_organizer', 'admin')
  async sendBroadcastMessage(
    @Body() dto: SendBroadcastMessageDto,
    @Request() req: any,
  ) {
    try {
      const { messageType, subject, message, customerIds } = dto;

      // Get all tickets for the organizer's events (or all events if admin)
      let allTickets: any[] = [];

      if (req.user.role === 'admin') {
        // Admin can broadcast to all customers
        allTickets = await this.ticketService.getAllTicketsForBroadcast();
      } else {
        // Organizer can only broadcast to customers from their events
        allTickets = await this.ticketService.getTicketsForOrganizer(
          req.user.id,
        );
      }

      // Filter by specific customer IDs if provided
      let targetTickets = allTickets;
      if (customerIds && customerIds.length > 0) {
        targetTickets = allTickets.filter((ticket) =>
          customerIds.includes(ticket.id),
        );
      }

      // Get unique customers (deduplicate by email)
      const uniqueCustomers = targetTickets.reduce(
        (acc: any[], ticket: any) => {
          const existingCustomer = acc.find(
            (c) => c.buyerEmail === ticket.buyerEmail,
          );
          if (!existingCustomer) {
            acc.push(ticket);
          }
          return acc;
        },
        [],
      );

      if (uniqueCustomers.length === 0) {
        throw new HttpException(
          'No customers found for broadcast',
          HttpStatus.NOT_FOUND,
        );
      }

      const results: MarketingResult[] = [];

      for (const customer of uniqueCustomers) {
        try {
          if (messageType === 'email') {
            if (!customer.buyerEmail) {
              results.push({
                customer: customer.buyerName,
                status: 'failed',
                reason: 'No email address',
              });
              continue;
            }
            await this.emailService.sendEmail(
              customer.buyerEmail,
              subject || 'Broadcast Message',
              message,
            );
            results.push({
              customer: customer.buyerName,
              status: 'sent',
              method: 'email',
            });
          } else if (messageType === 'sms') {
            if (!customer.buyerPhone) {
              results.push({
                customer: customer.buyerName,
                status: 'failed',
                reason: 'No phone number',
              });
              continue;
            }
            await this.smsService.sendMarketingMessage(
              customer.buyerPhone,
              message,
            );
            results.push({
              customer: customer.buyerName,
              status: 'sent',
              method: 'sms',
            });
          }
        } catch (error) {
          results.push({
            customer: customer.buyerName,
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        message: 'Broadcast messages processed',
        results,
        summary: {
          total: uniqueCustomers.length,
          sent: results.filter((r) => r.status === 'sent').length,
          failed: results.filter((r) => r.status === 'failed').length,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Failed to send broadcast messages: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('admin/broadcast')
  @Roles('admin')
  async adminBroadcast(@Body() dto: AdminBroadcastDto, @Request() req: any) {
    try {
      const { messageType, subject, message, targetType, targetId, userIds } =
        dto;

      let targetUsers: any[] = [];

      switch (targetType) {
        case 'all_users':
          targetUsers = await this.userService.findAll();
          break;

        case 'organizers':
          targetUsers =
            await this.userService.findUsersByRole('event_organizer');
          break;

        case 'customers': {
          // Get all customers (unique ticket buyers)
          const allTickets =
            await this.ticketService.getAllTicketsForBroadcast();
          targetUsers = allTickets.reduce((acc: any[], ticket: any) => {
            const existing = acc.find((u) => u.email === ticket.buyerEmail);
            if (!existing && ticket.buyerEmail) {
              acc.push({
                name: ticket.buyerName,
                email: ticket.buyerEmail,
                phone: ticket.buyerPhone,
              });
            }
            return acc;
          }, []);
          break;
        }

        case 'customers_by_event': {
          if (!targetId) {
            throw new HttpException(
              'Event ID required for event-specific broadcast',
              HttpStatus.BAD_REQUEST,
            );
          }
          const eventTickets =
            await this.ticketService.getTicketsForEvent(targetId);
          targetUsers = eventTickets.reduce((acc: any[], ticket: any) => {
            const existing = acc.find((u) => u.email === ticket.buyerEmail);
            if (!existing && ticket.buyerEmail) {
              acc.push({
                name: ticket.buyerName,
                email: ticket.buyerEmail,
                phone: ticket.buyerPhone,
              });
            }
            return acc;
          }, []);
          break;
        }

        case 'customers_by_organizer': {
          if (!targetId) {
            throw new HttpException(
              'Organizer ID required for organizer-specific broadcast',
              HttpStatus.BAD_REQUEST,
            );
          }
          const organizerTickets =
            await this.ticketService.getTicketsForOrganizer(targetId);
          targetUsers = organizerTickets.reduce((acc: any[], ticket: any) => {
            const existing = acc.find((u) => u.email === ticket.buyerEmail);
            if (!existing && ticket.buyerEmail) {
              acc.push({
                name: ticket.buyerName,
                email: ticket.buyerEmail,
                phone: ticket.buyerPhone,
              });
            }
            return acc;
          }, []);
          break;
        }
      }

      // Filter by specific user IDs if provided
      if (userIds && userIds.length > 0) {
        if (targetType === 'all_users' || targetType === 'organizers') {
          targetUsers = targetUsers.filter((user) => userIds.includes(user.id));
        }
      }

      if (targetUsers.length === 0) {
        throw new HttpException(
          'No users found for the specified criteria',
          HttpStatus.NOT_FOUND,
        );
      }

      const results: MarketingResult[] = [];

      for (const user of targetUsers) {
        try {
          const userEmail = user.email || user.buyerEmail;
          const userName = user.name || user.buyerName;
          const userPhone = user.phone || user.buyerPhone;

          if (messageType === 'email') {
            if (!userEmail) {
              results.push({
                customer: userName || 'Unknown User',
                status: 'failed',
                reason: 'No email address',
              });
              continue;
            }
            await this.emailService.sendEmail(
              userEmail,
              subject || 'Message from Tikoyangu Admin',
              message,
            );
            results.push({
              customer: userName || userEmail,
              status: 'sent',
              method: 'email',
            });
          } else if (messageType === 'sms') {
            if (!userPhone) {
              results.push({
                customer: userName || 'Unknown User',
                status: 'failed',
                reason: 'No phone number',
              });
              continue;
            }
            await this.smsService.sendMarketingMessage(userPhone, message);
            results.push({
              customer: userName || userPhone,
              status: 'sent',
              method: 'sms',
            });
          }
        } catch (error) {
          results.push({
            customer: user.name || user.buyerName || 'Unknown User',
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        success: true,
        message: 'Admin broadcast messages processed',
        targetType,
        results,
        summary: {
          total: targetUsers.length,
          sent: results.filter((r) => r.status === 'sent').length,
          failed: results.filter((r) => r.status === 'failed').length,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Failed to send admin broadcast: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('admin/targets')
  @Roles('admin')
  async getAdminBroadcastTargets() {
    try {
      const [allUsers, organizers, events] = await Promise.all([
        this.userService.getUserStatistics(),
        this.userService.findUsersByRole('event_organizer'),
        this.ticketService.getEventsWithCustomerCounts(),
      ]);

      const customersCount = await this.ticketService.getUniqueCustomersCount();

      return {
        statistics: {
          totalUsers: allUsers.totalUsers,
          organizers: organizers.length,
          totalCustomers: customersCount,
        },
        organizers: organizers.map((org) => ({
          id: org.id,
          name: org.name,
          email: org.email,
        })),
        events: events || [],
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get broadcast targets: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
