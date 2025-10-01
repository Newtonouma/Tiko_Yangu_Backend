import { Controller, Post, Body, Req } from '@nestjs/common';

@Controller('mpesa')
export class MpesaController {
  @Post('callback')
  async handleCallback(@Body() body: any, @Req() req: any) {
    // Log or process the callback data
    // You should verify the payment and update the ticket status here
    // For now, just log the callback
    console.log('M-Pesa Callback:', JSON.stringify(body));
    // Return a 200 OK to Safaricom
    return { resultCode: 0, resultDesc: 'Success' };
  }
}
