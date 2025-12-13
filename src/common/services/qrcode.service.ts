import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { ConfigService } from '@nestjs/config';

export interface QRCodeData {
  bookingId: string;
  bookingCode: string;
  userId: string;
  showtimeId: string;
  seats: string[];
  totalPrice: number;
  timestamp: number;
}

@Injectable()
export class QRCodeService {
  private readonly logger = new Logger(QRCodeService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Generate QR code as Data URL (base64 image)
   * @param data - Data to encode in QR code
   * @returns Base64 data URL string
   */
  async generateQRCodeDataURL(data: QRCodeData): Promise<string> {
    try {
      // Convert data to JSON string
      const jsonData = JSON.stringify(data);

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(jsonData, {
        errorCorrectionLevel: 'H', // High error correction
        type: 'image/png',
        margin: 1,
        width: 400,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      this.logger.log(`QR code generated for booking ${data.bookingCode}`);
      return qrCodeDataURL;
    } catch (error) {
      this.logger.error(`Failed to generate QR code: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate QR code as Buffer (for file storage or attachment)
   * @param data - Data to encode in QR code
   * @returns Buffer containing PNG image
   */
  async generateQRCodeBuffer(data: QRCodeData): Promise<Buffer> {
    try {
      const jsonData = JSON.stringify(data);

      const buffer = await QRCode.toBuffer(jsonData, {
        errorCorrectionLevel: 'H',
        type: 'png',
        margin: 1,
        width: 400,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      this.logger.log(`QR code buffer generated for booking ${data.bookingCode}`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to generate QR code buffer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify QR code data
   * @param qrData - Decoded QR code data (JSON string)
   * @returns Parsed and validated QR code data
   */
  verifyQRCode(qrData: string): {
    valid: boolean;
    data?: QRCodeData;
    error?: string;
  } {
    try {
      // Parse JSON
      const data: QRCodeData = JSON.parse(qrData);

      // Validate required fields
      if (
        !data.bookingId ||
        !data.bookingCode ||
        !data.userId ||
        !data.showtimeId ||
        !data.seats ||
        !data.totalPrice ||
        !data.timestamp
      ) {
        return {
          valid: false,
          error: 'Missing required fields in QR code data',
        };
      }

      // Check if QR code is not too old (e.g., generated within last 30 days)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (data.timestamp < thirtyDaysAgo) {
        return {
          valid: false,
          error: 'QR code has expired',
        };
      }

      this.logger.log(`QR code verified for booking ${data.bookingCode}`);
      return {
        valid: true,
        data,
      };
    } catch (error) {
      this.logger.error(`Failed to verify QR code: ${error.message}`);
      return {
        valid: false,
        error: 'Invalid QR code format',
      };
    }
  }

  /**
   * Generate simple QR code with just booking code (for quick scanning)
   * @param bookingCode - Booking code string
   * @returns Base64 data URL string
   */
  async generateSimpleQRCode(bookingCode: string): Promise<string> {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(bookingCode, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 2,
        width: 300,
        color: {
          dark: '#667eea',
          light: '#FFFFFF',
        },
      });

      this.logger.log(`Simple QR code generated for booking ${bookingCode}`);
      return qrCodeDataURL;
    } catch (error) {
      this.logger.error(`Failed to generate simple QR code: ${error.message}`);
      throw error;
    }
  }
}
