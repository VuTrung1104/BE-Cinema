import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { CreateMoMoPaymentDto, MoMoReturnDto, MoMoIPNDto } from '../dto/momo-payment.dto';
import { buildCreateRawSignature, buildIPNRawSignature, hmacSHA256 } from '../utils/momo.util';

@Injectable()
export class MomoService {
  private readonly logger = new Logger(MomoService.name);
  
  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly createUrl: string;
  private readonly redirectUrl: string;
  private readonly ipnUrl: string;

  constructor(private configService: ConfigService) {
    this.partnerCode = this.configService.get<string>('MOMO_PARTNER_CODE');
    this.accessKey = this.configService.get<string>('MOMO_ACCESS_KEY');
    this.secretKey = this.configService.get<string>('MOMO_SECRET_KEY');
    this.createUrl = this.configService.get<string>('MOMO_ENDPOINT') || 'https://test-payment.momo.vn/v2/gateway/api/create';
    this.redirectUrl = this.configService.get<string>('MOMO_REDIRECT_URL') || 'http://localhost:5000/api/v1/payments/momo-return';
    this.ipnUrl = this.configService.get<string>('MOMO_IPN_URL') || 'http://localhost:5000/api/v1/payments/momo-ipn';
  }

  /**
   * Create MoMo payment URL
   */
  async createPayment(dto: CreateMoMoPaymentDto & { orderId: string }) {
    const { orderId, amount, orderInfo = 'Payment with MoMo' } = dto;
    const requestId = randomUUID();
    const requestType = 'captureWallet';
    const extraData = '';

    // Build signature
    const rawSignature = buildCreateRawSignature({
      accessKey: this.accessKey,
      amount: String(amount),
      extraData,
      ipnUrl: this.ipnUrl,
      orderId,
      orderInfo,
      partnerCode: this.partnerCode,
      redirectUrl: this.redirectUrl,
      requestId,
      requestType,
    });

    const signature = hmacSHA256(rawSignature, this.secretKey);

    const payload = {
      partnerCode: this.partnerCode,
      accessKey: this.accessKey,
      requestId,
      amount: Number(amount),
      orderId,
      orderInfo,
      redirectUrl: this.redirectUrl,
      ipnUrl: this.ipnUrl,
      requestType,
      extraData,
      signature,
      lang: 'vi',
    };

    try {
      const { data } = await axios.post(this.createUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      });

      if (data?.resultCode !== 0) {
        throw new BadRequestException(
          `MoMo error (${data?.resultCode}): ${data?.message || 'Unknown error'}`,
        );
      }

      return {
        payUrl: data.payUrl,
        qrCodeUrl: data.qrCodeUrl,
        orderId,
        requestId,
      };
    } catch (error) {
      this.logger.error(`MoMo create payment error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify MoMo IPN/Return signature
   */
  verifySignature(data: MoMoReturnDto | MoMoIPNDto): { isValid: boolean } {
    try {
      const rawSignature = buildIPNRawSignature({
        accessKey: this.accessKey,
        amount: String(data.amount),
        extraData: data.extraData || '',
        message: data.message,
        orderId: data.orderId,
        orderInfo: data.orderInfo,
        orderType: data.orderType,
        partnerCode: this.partnerCode,
        payType: data.payType || '',
        requestId: data.requestId,
        responseTime: String(data.responseTime),
        resultCode: String(data.resultCode),
        transId: data.transId || '',
      });

      const computedSignature = hmacSHA256(rawSignature, this.secretKey);
      const isValid = computedSignature === data.signature;

      if (!isValid) {
        this.logger.warn(`Signature mismatch - Expected: ${computedSignature}, Received: ${data.signature}`);
      }

      return { isValid };
    } catch (error) {
      this.logger.error(`Verify signature error: ${error.message}`);
      return { isValid: false };
    }
  }
}
