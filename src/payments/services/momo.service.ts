import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

export interface MoMoPaymentDto {
  orderId: string;
  amount: number;
  orderInfo: string;
  redirectUrl?: string;
  ipnUrl?: string;
  extraData?: string;
}

export interface MoMoPaymentResponse {
  payUrl: string;
  deeplink?: string;
  qrCodeUrl?: string;
  orderId: string;
  requestId: string;
}

@Injectable()
export class MomoService {
  private readonly logger = new Logger(MomoService.name);
  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly endpoint: string;

  constructor(private configService: ConfigService) {
    this.partnerCode = this.configService.get<string>('MOMO_PARTNER_CODE') || '';
    this.accessKey = this.configService.get<string>('MOMO_ACCESS_KEY') || '';
    this.secretKey = this.configService.get<string>('MOMO_SECRET_KEY') || '';
    this.endpoint = this.configService.get<string>('MOMO_ENDPOINT') || 'https://test-payment.momo.vn/v2/gateway/api/create';
  }

  /**
   * Create MoMo payment URL
   * @param paymentData Payment details
   * @returns Payment URL and other info
   */
  async createPayment(paymentData: MoMoPaymentDto): Promise<MoMoPaymentResponse> {
    const {
      orderId,
      amount,
      orderInfo,
      redirectUrl = this.configService.get<string>('FRONTEND_URL') + '/payment/result',
      ipnUrl = this.configService.get<string>('BACKEND_URL') + '/payments/momo/callback',
      extraData = '',
    } = paymentData;

    // Generate request ID
    const requestId = `${orderId}_${Date.now()}`;
    const requestType = 'captureWallet';
    const lang = 'vi';

    // Create raw signature
    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    // Generate signature using HMAC SHA256
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    // Prepare request body
    const requestBody = {
      partnerCode: this.partnerCode,
      accessKey: this.accessKey,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      signature,
      lang,
    };

    this.logger.log(`Creating MoMo payment for order ${orderId}, amount: ${amount}`);

    try {
      // Send request to MoMo
      const response = await axios.post(this.endpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const { resultCode, message, payUrl, deeplink, qrCodeUrl } = response.data;

      if (resultCode !== 0) {
        this.logger.error(`MoMo payment creation failed: ${message}`);
        throw new BadRequestException(`MoMo payment failed: ${message}`);
      }

      this.logger.log(`MoMo payment URL created successfully for order ${orderId}`);

      return {
        payUrl,
        deeplink,
        qrCodeUrl,
        orderId,
        requestId,
      };
    } catch (error) {
      this.logger.error('Error creating MoMo payment:', error.message);
      throw new BadRequestException('Failed to create MoMo payment');
    }
  }

  /**
   * Verify MoMo callback signature
   * @param callbackData Data from MoMo callback
   * @returns true if signature is valid
   */
  verifyCallback(callbackData: any): boolean {
    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = callbackData;

    // Create raw signature (must match MoMo's order)
    const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    // Generate signature
    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    const isValid = signature === expectedSignature;

    if (!isValid) {
      this.logger.warn(`Invalid MoMo callback signature for order ${orderId}`);
    }

    return isValid;
  }

  /**
   * Check if payment was successful
   * @param resultCode Result code from MoMo
   * @returns true if payment successful
   */
  isPaymentSuccessful(resultCode: number): boolean {
    return resultCode === 0;
  }
}
