import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Post,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntityType } from './audit-log.entity';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  async getAuditLogs(
    @Query('userId') userId?: number,
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: AuditEntityType,
    @Query('entityId') entityId?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return await this.auditService.getAuditLogs({
      userId: userId ? Number(userId) : undefined,
      action,
      entityType,
      entityId: entityId ? Number(entityId) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('statistics')
  async getAuditStatistics() {
    return await this.auditService.getAuditStatistics();
  }

  @Get('export')
  async exportAuditLogs(
    @Query('userId') userId?: number,
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: AuditEntityType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const logs = await this.auditService.exportAuditLogs({
      userId: userId ? Number(userId) : undefined,
      action,
      entityType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return {
      logs,
      exportedAt: new Date().toISOString(),
      totalLogs: logs.length,
    };
  }

  @Post('cleanup')
  async cleanupOldLogs(
    @Body() body: { daysToKeep: number },
    @Request() req: any,
  ) {
    const deletedCount = await this.auditService.cleanupOldLogs(body.daysToKeep);
    
    // Log the cleanup action
    await this.auditService.logUserAction(
      AuditAction.DELETE,
      AuditEntityType.SYSTEM,
      req.user,
      {
        description: `Cleaned up ${deletedCount} audit logs older than ${body.daysToKeep} days`,
        metadata: { deletedCount, daysToKeep: body.daysToKeep },
      },
    );

    return {
      message: `Deleted ${deletedCount} old audit logs`,
      deletedCount,
      daysToKeep: body.daysToKeep,
    };
  }

  @Post('test/create-sample-logs')
  async createSampleLogs(@Request() req) {
    // Create sample audit logs for testing
    const sampleLogs = [
      {
        action: AuditAction.LOGIN,
        entityType: AuditEntityType.USER,
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        description: 'Admin login successful',
        ipAddress: '127.0.0.1',
      },
      {
        action: AuditAction.APPROVE,
        entityType: AuditEntityType.EVENT,
        entityId: 14,
        entityName: 'Urban Night',
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        description: 'Event approved for publication',
        metadata: { eventTitle: 'Urban Night', organizer: 'organizer@gmail.com' },
      },
      {
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.USER,
        entityId: 7,
        entityName: 'organizer',
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        description: 'User role updated',
        previousData: { role: 'user' },
        newData: { role: 'event_organizer' },
      },
      {
        action: AuditAction.REFUND,
        entityType: AuditEntityType.TICKET,
        entityId: 1,
        entityName: 'Ticket #1',
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.role,
        description: 'Ticket refund processed',
        metadata: { amount: 1000, reason: 'Event cancelled' },
      },
    ];

    const createdLogs: any[] = [];
    for (const logData of sampleLogs) {
      const log = await this.auditService.log(logData);
      createdLogs.push(log);
    }

    return {
      message: `Created ${createdLogs.length} sample audit logs`,
      logs: createdLogs,
    };
  }
}