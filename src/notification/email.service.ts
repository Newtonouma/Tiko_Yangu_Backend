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
    ticketPdfBuffer?: Buffer,
    eventDetails?: {
      venue: string;
      location: string;
      startDate: string;
      startTime: string;
      endDate: string;
      endTime: string;
      ticketType: string;
      price: number;
      buyerName: string;
    },
  ) {
    const emailEnabled = await this.isEmailEnabled();
    if (!emailEnabled) {
      this.logger.warn(`Email disabled; skipping ticket confirmation to ${to}`);
      return;
    }
    try {
      const subject = `Your Ticket for ${eventName} - Ticket #${ticketId}`;
      const appUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

      // Build event details HTML
      let eventDetailsHtml = '';
      if (eventDetails) {
        const dateStr = new Date(eventDetails.startDate).toLocaleDateString(
          'en-US',
          { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
        );
        eventDetailsHtml = `
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:24px 0;">
            <h3 style="margin:0 0 16px 0;color:#111827;font-size:18px;">Event Details</h3>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;"><strong>Event:</strong></td><td style="padding:6px 0;color:#111827;font-size:14px;">${eventName}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;"><strong>Venue:</strong></td><td style="padding:6px 0;color:#111827;font-size:14px;">${eventDetails.venue}, ${eventDetails.location}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;"><strong>Date:</strong></td><td style="padding:6px 0;color:#111827;font-size:14px;">${dateStr}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;"><strong>Time:</strong></td><td style="padding:6px 0;color:#111827;font-size:14px;">${eventDetails.startTime} - ${eventDetails.endTime}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;"><strong>Ticket Type:</strong></td><td style="padding:6px 0;color:#111827;font-size:14px;">${eventDetails.ticketType}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;"><strong>Price:</strong></td><td style="padding:6px 0;color:#111827;font-size:14px;">KES ${eventDetails.price.toLocaleString()}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;"><strong>Attendee:</strong></td><td style="padding:6px 0;color:#111827;font-size:14px;">${eventDetails.buyerName}</td></tr>
            </table>
          </div>
        `;
      }

      const htmlBody = this.wrapHtml(
        subject,
        `
          <h2 style="color:#111827;margin:0 0 16px 0;">🎉 Your Ticket is Confirmed!</h2>
          <p style="color:#374151;line-height:1.6;margin:0 0 16px 0;">Hi <strong>${eventDetails?.buyerName || 'there'}</strong>,</p>
          <p style="color:#374151;line-height:1.6;margin:0 0 16px 0;">Thank you for purchasing your ticket! Your payment has been confirmed and your ticket is attached as a PDF.</p>
          ${eventDetailsHtml}
          <div style="background:#dbeafe;border-left:4px solid #2563eb;padding:16px;margin:24px 0;border-radius:4px;">
            <p style="margin:0;color:#1e40af;font-size:14px;"><strong>📎 Your ticket is attached</strong> — Please download and save it. You'll need to present it at the venue entrance.</p>
          </div>
          <div style="margin:32px 0;text-align:center;">
            <a href="${appUrl}/events" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">Browse More Events</a>
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;" />
          <div style="background:#f9fafb;padding:20px;border-radius:8px;text-align:center;margin:24px 0;">
            <h3 style="margin:0 0 12px 0;color:#111827;font-size:16px;">Host Your Own Event</h3>
            <p style="color:#6b7280;font-size:14px;line-height:1.5;margin:0 0 16px 0;">Create and manage events with Tikoyangu's powerful platform. Reach thousands of attendees.</p>
            <a href="${appUrl}/register" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;">Create Your Event</a>
          </div>
        `,
      );

      const mailOptions: any = {
        from: this.fromAddress(),
        to,
        subject,
        text: `Thank you for purchasing your ticket for ${eventName}! Your ticket ID is ${ticketId}. Please find your ticket attached as a PDF.`,
        html: htmlBody,
      };

      // Attach PDF if provided
      if (ticketPdfBuffer) {
        mailOptions.attachments = [
          {
            filename: `ticket-${ticketId}.pdf`,
            content: ticketPdfBuffer,
            contentType: 'application/pdf',
          },
        ];
      }

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Confirmation email with PDF sent to ${to}`);
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
