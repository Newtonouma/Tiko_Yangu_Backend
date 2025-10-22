import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  private consumerKey = process.env.MPESA_CONSUMER_KEY;
  private consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  private shortcode = process.env.MPESA_SHORTCODE;
  private passkey = process.env.MPESA_PASSKEY;
  private callbackUrl = process.env.MPESA_CALLBACK_URL;

  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(
      `${this.consumerKey}:${this.consumerSecret}`,
    ).toString('base64');
    try {
      const res = await axios.get(
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        {
          headers: { Authorization: `Basic ${auth}` },
        },
      );
      return res.data.access_token;
    } catch (error) {
      throw new HttpException(
        'Failed to get M-Pesa access token',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async stkPush({
    amount,
    phone,
    accountReference,
    transactionDesc,
  }: {
    amount: number;
    phone: string;
    accountReference: string;
    transactionDesc: string;
  }) {
    const accessToken = await this.getAccessToken();
    const timestamp = this.getTimestamp();
    const password = Buffer.from(
      `${this.shortcode}${this.passkey}${timestamp}`,
    ).toString('base64');

    // Resolve callback URL at call time (not only at module init)
    const rawCallback = process.env.MPESA_CALLBACK_URL || this.callbackUrl || '';
    const callbackUrl = rawCallback.replace(/\/$/, '');

    // Build request body
    const body = {
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline' as const,
      Amount: amount,
      PartyA: phone,
      PartyB: this.shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    };

    // Log sanitized payload (mask sensitive fields)
    try {
      const masked = {
        ...body,
        Password: '***MASKED***',
        PartyA: phone?.replace(/^(\+?\d{3})\d+(\d{2})$/, '$1******$2') || phone,
        PhoneNumber: phone?.replace(/^(\+?\d{3})\d+(\d{2})$/, '$1******$2') || phone,
      };
      this.logger.log(`STK Push endpoint: https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest`);
      this.logger.log(`STK Push payload: ${JSON.stringify(masked)}`);
      this.logger.log(`Callback URL: ${callbackUrl}`);
    } catch {}

    try {
      const res = await axios.post(
        'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        body,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      return res.data;
    } catch (error) {
      if (error.response) {
        this.logger.error(`STK Push error response: ${JSON.stringify(error.response.data)}`);
        throw new HttpException(
          {
            message: 'M-Pesa STK Push failed',
            details: error.response.data,
          },
          HttpStatus.BAD_GATEWAY,
        );
      } else {
        this.logger.error(`STK Push network error: ${error?.message || error}`);
        throw new HttpException(
          'M-Pesa STK Push failed',
          HttpStatus.BAD_GATEWAY,
        );
      }
    }
  }

  private getTimestamp(): string {
    const date = new Date();
    const yyyy = date.getFullYear();
    const MM = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    const ss = date.getSeconds().toString().padStart(2, '0');
    return `${yyyy}${MM}${dd}${hh}${mm}${ss}`;
  }
}
