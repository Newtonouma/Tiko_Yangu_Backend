import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AuditLog, AuditAction, AuditEntityType } from './audit-log.entity';
import { User } from '../user/user.entity';

export interface AuditLogData {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: number;
  entityName?: string;
  user?: User;
  userId?: number;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  description?: string;
  metadata?: Record<string, any>;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
  isSuccess?: boolean;
  errorMessage?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(data: AuditLogData): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      ...data,
      isSuccess: data.isSuccess ?? true,
    });

    return await this.auditLogRepository.save(auditLog);
  }

  async logUserAction(
    action: AuditAction,
    entityType: AuditEntityType,
    user: any,
    options?: {
      entityId?: number;
      entityName?: string;
      description?: string;
      metadata?: Record<string, any>;
      previousData?: Record<string, any>;
      newData?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
      isSuccess?: boolean;
      errorMessage?: string;
    },
  ): Promise<AuditLog> {
    return await this.log({
      action,
      entityType,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      ...options,
    });
  }

  async getAuditLogs(filters?: {
    userId?: number;
    action?: AuditAction;
    entityType?: AuditEntityType;
    entityId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: AuditLog[];
    total: number;
  }> {
    const query = this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user');

    if (filters?.userId) {
      query.andWhere('audit.userId = :userId', { userId: filters.userId });
    }

    if (filters?.action) {
      query.andWhere('audit.action = :action', { action: filters.action });
    }

    if (filters?.entityType) {
      query.andWhere('audit.entityType = :entityType', {
        entityType: filters.entityType,
      });
    }

    if (filters?.entityId) {
      query.andWhere('audit.entityId = :entityId', {
        entityId: filters.entityId,
      });
    }

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('audit.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters?.startDate) {
      query.andWhere('audit.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    } else if (filters?.endDate) {
      query.andWhere('audit.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    query.orderBy('audit.createdAt', 'DESC');

    if (filters?.limit) {
      query.limit(filters.limit);
    }

    if (filters?.offset) {
      query.offset(filters.offset);
    }

    const [logs, total] = await query.getManyAndCount();

    return { logs, total };
  }

  async getAuditStatistics(): Promise<{
    totalLogs: number;
    actionBreakdown: Record<string, number>;
    entityBreakdown: Record<string, number>;
    userBreakdown: Array<{
      userId: number;
      userEmail: string;
      actionCount: number;
    }>;
    recentActivity: AuditLog[];
    topActions: Array<{
      action: string;
      count: number;
    }>;
    dailyActivity: Array<{
      date: string;
      count: number;
    }>;
  }> {
    const totalLogs = await this.auditLogRepository.count();

    // Get action breakdown
    const actionResults = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('audit.action')
      .getRawMany();

    const actionBreakdown = actionResults.reduce(
      (acc, item) => {
        acc[item.action] = parseInt(item.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    // Get entity breakdown
    const entityResults = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.entityType', 'entityType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('audit.entityType')
      .getRawMany();

    const entityBreakdown = entityResults.reduce(
      (acc, item) => {
        acc[item.entityType] = parseInt(item.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    // Get user breakdown
    const userResults = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.userId', 'userId')
      .addSelect('audit.userEmail', 'userEmail')
      .addSelect('COUNT(*)', 'actionCount')
      .where('audit.userId IS NOT NULL')
      .groupBy('audit.userId, audit.userEmail')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany();

    const userBreakdown = userResults.map((item) => ({
      userId: item.userId,
      userEmail: item.userEmail,
      actionCount: parseInt(item.actionCount),
    }));

    // Get recent activity
    const recentActivity = await this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
      take: 20,
      relations: ['user'],
    });

    // Get top actions
    const topActions = Object.entries(actionBreakdown)
      .map(([action, count]) => ({ action, count: Number(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get daily activity for the last 30 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const dailyResults = await this.auditLogRepository
      .createQueryBuilder('audit')
      .select('DATE(audit.createdAt)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('audit.createdAt >= :startDate', { startDate })
      .groupBy('DATE(audit.createdAt)')
      .orderBy('DATE(audit.createdAt)', 'ASC')
      .getRawMany();

    const dailyActivity = dailyResults.map((item) => ({
      date: item.date,
      count: parseInt(item.count),
    }));

    return {
      totalLogs,
      actionBreakdown,
      entityBreakdown,
      userBreakdown,
      recentActivity,
      topActions,
      dailyActivity,
    };
  }

  async exportAuditLogs(filters?: {
    userId?: number;
    action?: AuditAction;
    entityType?: AuditEntityType;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AuditLog[]> {
    const { logs } = await this.getAuditLogs({
      ...filters,
      limit: 10000, // Export up to 10k logs
    });

    return logs;
  }

  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.auditLogRepository.delete({
      createdAt: Between(new Date('1970-01-01'), cutoffDate),
    });

    return result.affected || 0;
  }
}
