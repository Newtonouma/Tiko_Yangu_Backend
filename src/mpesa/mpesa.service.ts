import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MpesaService {
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
    try {
      const res = await axios.post(
        'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        {
          BusinessShortCode: this.shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phone,
          PartyB: this.shortcode,
          PhoneNumber: phone,
          CallBackURL: this.callbackUrl,
          AccountReference: accountReference,
          TransactionDesc: transactionDesc,
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      return res.data;
    } catch (error) {
      if (error.response) {
        throw new HttpException(
          {
            message: 'M-Pesa STK Push failed',
            details: error.response.data,
          },
          HttpStatus.BAD_GATEWAY,
        );
      } else {
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
