import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private initialized = false;

  constructor(private readonly settingsService: SettingsService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
      },
    });

    // Verify connection configuration
    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      const emailEnabled = await this.isEmailEnabled();
      if (!emailEnabled) {
        this.logger.warn('Email notifications are disabled by settings.');
        return;
      }
      await this.transporter.verify();
      this.initialized = true;
      this.logger.log('✅ SMTP connection verified successfully');
    } catch (error: any) {
      this.logger.error(
        `❌ SMTP connection failed: ${error?.message || error}`,
      );
    }
  }

  private async isEmailEnabled(): Promise<boolean> {
    try {
      return await this.settingsService.getSettingValue<boolean>(
        'notifications.email_enabled',
      );
    } catch {
      // Default to true if setting not found
      return true;
    }
  }

  private fromAddress(): string {
    const name = process.env.EMAIL_FROM_NAME || 'Tikoyangu';
    const addr =
      process.env.SMTP_FROM || process.env.EMAIL_USER || 'no-reply@example.com';
    return `${name} <${addr}>`;
  }

  private wrapHtml(subject: string, bodyHtml: string): string {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${subject}</title>
  </head>
  <body style="font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;margin:0;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #eaeaea;border-radius:8px;overflow:hidden;">
      <div style="background:#111827;color:#fff;padding:16px 24px;font-weight:600;">${process.env.EMAIL_FROM_NAME || 'Tikoyangu'}</div>
      <div style="padding:24px;color:#111827;line-height:1.6;">${bodyHtml}</div>
      <div style="padding:16px 24px;color:#6b7280;font-size:12px;border-top:1px solid #f0f0f0;">This is an automated message. Please do not reply.</div>
    </div>
  </body>
</html>`;
  }

  async sendTicketConfirmation(
    to: string,
    eventName: string,
    ticketId: number,
  ) {
    const emailEnabled = await this.isEmailEnabled();
    if (!emailEnabled) {
      this.logger.warn(`Email disabled; skipping ticket confirmation to ${to}`);
      return;
    }
    try {
      const subject = `Your Ticket for ${eventName}`;
      const htmlBody = this.wrapHtml(
        subject,
        `
          <p>Thank you for purchasing a ticket!</p>
          <p>Your ticket ID is <strong>${ticketId}</strong>.</p>
          <p>Event: <strong>${eventName}</strong></p>
        `,
      );
      await this.transporter.sendMail({
        from: this.fromAddress(),
        to,
        subject,
        text: `Thank you for purchasing a ticket! Your ticket ID is ${ticketId}. Event: ${eventName}`,
        html: htmlBody,
      });
      this.logger.log(`Confirmation email sent to ${to}`);
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${error?.message || error}`);
    }
  }

  async sendEmail(to: string, subject: string, message: string, html?: string) {
    const emailEnabled = await this.isEmailEnabled();
    if (!emailEnabled) {
      this.logger.warn(
        `Email disabled; skipping message to ${to} - ${subject}`,
      );
      return;
    }
    try {
      const bodyHtml =
        html ||
        this.wrapHtml(
          subject,
          `<p>${(message || '').replace(/\n/g, '<br/>')}</p>`,
        );
      await this.transporter.sendMail({
        from: this.fromAddress(),
        to,
        subject,
        text: message,
        html: bodyHtml,
      });
      this.logger.log(`Email sent to ${to} with subject: ${subject}`);
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${error?.message || error}`);
    }
  }

  async sendPasswordReset(to: string, token: string) {
    const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || '';
    const resetLink = baseUrl
      ? `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
      : `Use this token to reset your password: ${token}`;

    const subject = 'Reset your Tikoyangu password';
    const htmlBody = this.wrapHtml(
      subject,
      `
        <p>We received a request to reset your password.</p>
        <p>Click the button below to proceed.</p>
        ${
          baseUrl
            ? `<p style="margin:24px 0;"><a href="${resetLink}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 16px;border-radius:6px;display:inline-block;">Reset Password</a></p>`
            : `<p>${resetLink}</p>`
        }
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
    );

    await this.sendEmail(
      to,
      subject,
      baseUrl
        ? `Open this link to reset your password: ${resetLink}`
        : `Token: ${token}`,
      htmlBody,
    );
  }
}
