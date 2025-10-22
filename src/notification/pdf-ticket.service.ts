import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

export interface TicketData {
  ticketId: number;
  qrCode: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  eventTitle: string;
  eventVenue: string;
  eventLocation: string;
  eventStartDate: string;
  eventStartTime: string;
  eventEndDate: string;
  eventEndTime: string;
  ticketType: string;
  price: number;
}

@Injectable()
export class PdfTicketService {
  async generateTicketPdf(ticketData: TicketData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(ticketData.qrCode, {
          width: 200,
          margin: 1,
        });

        // Create PDF in landscape A4 (842 x 595 points)
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margin: 40,
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Brand color
        const primaryColor = '#2563eb';
        const textDark = '#111827';
        const textGray = '#6b7280';
        const pageWidth = 842;
        const pageHeight = 595;
        const margin = 40;
        const contentWidth = pageWidth - margin * 2;

        // Background border
        doc
          .rect(margin, margin, contentWidth, pageHeight - margin * 2)
          .lineWidth(2)
          .strokeColor('#e5e7eb')
          .stroke();

        // Header section with colored bar
        doc
          .rect(margin, margin, contentWidth, 80)
          .fillColor('#f0f9ff')
          .fill();

        // Brand name
        doc
          .fillColor(primaryColor)
          .fontSize(32)
          .font('Helvetica-Bold')
          .text('Tikoyangu', margin + 30, margin + 20);

        doc
          .fillColor(textGray)
          .fontSize(12)
          .font('Helvetica')
          .text('Event Ticket', margin + 30, margin + 58);

        // Ticket ID in top right
        doc
          .fillColor(textDark)
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(`Ticket #${ticketData.ticketId}`, pageWidth - 200, margin + 35, {
            align: 'right',
            width: 160,
          });

        // Main content area
        const contentY = margin + 100;
        const leftColumnX = margin + 30;
        const leftColumnWidth = 420;

        // Event Title
        doc
          .fillColor(textDark)
          .fontSize(24)
          .font('Helvetica-Bold')
          .text(ticketData.eventTitle, leftColumnX, contentY, {
            width: leftColumnWidth,
          });

        // Event Details
        const detailsStartY = contentY + 60;
        const lineHeight = 28;
        doc.fillColor(textGray).fontSize(12).font('Helvetica');

        // Venue
        doc
          .font('Helvetica-Bold')
          .fillColor(textGray)
          .text('Venue:', leftColumnX, detailsStartY)
          .font('Helvetica')
          .fillColor(textDark)
          .text(
            `${ticketData.eventVenue}, ${ticketData.eventLocation}`,
            leftColumnX + 90,
            detailsStartY,
            { width: leftColumnWidth - 90 },
          );

        // Date & Time
        const dateStr = new Date(ticketData.eventStartDate).toLocaleDateString(
          'en-US',
          { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
        );
        doc
          .font('Helvetica-Bold')
          .fillColor(textGray)
          .text('Date:', leftColumnX, detailsStartY + lineHeight)
          .font('Helvetica')
          .fillColor(textDark)
          .text(dateStr, leftColumnX + 90, detailsStartY + lineHeight);

        doc
          .font('Helvetica-Bold')
          .fillColor(textGray)
          .text('Time:', leftColumnX, detailsStartY + lineHeight * 2)
          .font('Helvetica')
          .fillColor(textDark)
          .text(
            `${ticketData.eventStartTime} - ${ticketData.eventEndTime}`,
            leftColumnX + 90,
            detailsStartY + lineHeight * 2,
          );

        // Ticket Type & Price
        doc
          .font('Helvetica-Bold')
          .fillColor(textGray)
          .text('Type:', leftColumnX, detailsStartY + lineHeight * 3)
          .font('Helvetica')
          .fillColor(textDark)
          .text(
            ticketData.ticketType,
            leftColumnX + 90,
            detailsStartY + lineHeight * 3,
          );

        doc
          .font('Helvetica-Bold')
          .fillColor(textGray)
          .text('Price:', leftColumnX, detailsStartY + lineHeight * 4)
          .font('Helvetica')
          .fillColor(textDark)
          .text(
            `KES ${ticketData.price.toLocaleString()}`,
            leftColumnX + 90,
            detailsStartY + lineHeight * 4,
          );

        // Attendee Details
        doc
          .font('Helvetica-Bold')
          .fillColor(textGray)
          .text('Attendee:', leftColumnX, detailsStartY + lineHeight * 5)
          .font('Helvetica')
          .fillColor(textDark)
          .text(
            ticketData.buyerName,
            leftColumnX + 90,
            detailsStartY + lineHeight * 5,
          );

        // QR Code section on the right
        const qrSize = 180;
        const qrX = pageWidth - margin - qrSize - 40;
        const qrY = contentY + 40;

        // QR background
        doc
          .rect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 50)
          .fillColor('#ffffff')
          .fill()
          .strokeColor('#e5e7eb')
          .lineWidth(1)
          .stroke();

        doc.image(qrDataUrl, qrX, qrY, { width: qrSize, height: qrSize });

        doc
          .fillColor(textGray)
          .fontSize(10)
          .font('Helvetica')
          .text('Scan to verify', qrX - 15, qrY + qrSize + 10, {
            width: qrSize + 30,
            align: 'center',
          });

        // Footer
        const footerY = pageHeight - margin - 40;
        doc
          .strokeColor('#e5e7eb')
          .lineWidth(1)
          .moveTo(margin + 30, footerY)
          .lineTo(pageWidth - margin - 30, footerY)
          .stroke();

        doc
          .fillColor(textGray)
          .fontSize(9)
          .font('Helvetica')
          .text(
            'Please present this ticket at the venue entrance. Keep it safe and do not share.',
            margin + 30,
            footerY + 12,
            { width: contentWidth - 60, align: 'center' },
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
