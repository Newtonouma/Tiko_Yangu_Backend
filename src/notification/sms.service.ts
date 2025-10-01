import { Injectable, Logger } from '@nestjs/common';
import * as twilio from 'twilio';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  async sendTicketConfirmation(
    to: string,
    eventName: string,
    ticketId: number,
  ) {
    try {
      await this.client.messages.create({
        body: `Your ticket for ${eventName} (ID: ${ticketId}) is confirmed!`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to,
      });
      this.logger.log(`Confirmation SMS sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`);
    }
  }
}
