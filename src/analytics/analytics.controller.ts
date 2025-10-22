import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async getDashboardOverview() {
    return await this.analyticsService.getDashboardOverview();
  }

  @Get('revenue')
  async getRevenueAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.analyticsService.getRevenueAnalytics(startDate, endDate);
  }

  @Get('users')
  async getUserAnalytics() {
    return await this.analyticsService.getUserAnalytics();
  }

  @Get('platform-metrics')
  async getPlatformMetrics() {
    const [dashboard, revenue, users] = await Promise.all([
      this.analyticsService.getDashboardOverview(),
      this.analyticsService.getRevenueAnalytics(),
      this.analyticsService.getUserAnalytics(),
    ]);

    return {
      overview: {
        totalUsers: dashboard.totalUsers,
        totalEvents: dashboard.totalEvents,
        totalTickets: dashboard.totalTickets,
        totalRevenue: dashboard.totalRevenue,
        activeEvents: dashboard.activeEvents,
        pendingEvents: dashboard.pendingEvents,
      },
      growth: dashboard.monthlyGrowth,
      revenue: {
        total: revenue.totalRevenue,
        paid: revenue.paidRevenue,
        refunded: revenue.refundedAmount,
        projected: revenue.projectedRevenue,
      },
      users: {
        total: users.totalUsers,
        active: users.activeUsers,
        byRole: users.usersByRole,
        engagement: users.userEngagement,
      },
      topPerformers: {
        events: revenue.topPerformingEvents,
        organizers: users.topEventOrganizers,
      },
      trends: {
        userRegistration: users.userRegistrationTrend,
        revenue: revenue.revenueByMonth,
      },
      recentActivity: dashboard.recentActivity,
    };
  }

  @Get('export')
  async exportAnalytics(
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.getPlatformMetrics();

    if (format === 'csv') {
      // For now, return JSON. In a real implementation, you'd convert to CSV
      // You could use a library like 'json2csv' for proper CSV conversion
      return {
        message: 'CSV export not implemented yet. Returning JSON data.',
        data,
        format: 'json',
      };
    }

    return {
      data,
      exportedAt: new Date().toISOString(),
      format: 'json',
      period: {
        start: startDate || 'all-time',
        end: endDate || 'now',
      },
    };
  }
}
