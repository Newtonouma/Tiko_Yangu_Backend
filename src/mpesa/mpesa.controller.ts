import { Controller, Post, Body, Req, Logger } from '@nestjs/common';
import { TicketService } from '../ticket/ticket.service';

@Controller('mpesa')
export class MpesaController {
  private readonly logger = new Logger(MpesaController.name);

  constructor(private readonly ticketService: TicketService) {}

  @Post('callback')
  async handleCallback(@Body() body: any, @Req() req: any) {
    // Log the full callback payload for debugging
    this.logger.log('=== M-Pesa Callback Received ===');
    this.logger.log(`Raw body: ${JSON.stringify(body, null, 2)}`);

    // Safaricom STK callback format
    // {
    //   "Body": { "stkCallback": { "MerchantRequestID": "...", "CheckoutRequestID": "...", "ResultCode": 0, "ResultDesc": "...", "CallbackMetadata": { ... } } }
    // }
    try {
      const stk = body?.Body?.stkCallback || body?.stkCallback || body;
      const checkoutId = stk?.CheckoutRequestID;
      const resultCode = Number(stk?.ResultCode);

      this.logger.log(`Parsed - CheckoutRequestID: ${checkoutId}, ResultCode: ${resultCode}`);

      const success = resultCode === 0;
      if (checkoutId) {
        this.logger.log(`Processing ticket with CheckoutRequestID: ${checkoutId}, success: ${success}`);
        await this.ticketService.finalizePaymentByCheckoutId(checkoutId, success, stk);
      } else {
        this.logger.warn('No CheckoutRequestID found in callback');
      }
    } catch (e) {
      // Log and continue to return 200 so M-Pesa stops retrying
      this.logger.error('M-Pesa callback processing error:', e);
    }

    // Return a 200 OK to Safaricom
    return { resultCode: 0, resultDesc: 'Success' };
  }
}
