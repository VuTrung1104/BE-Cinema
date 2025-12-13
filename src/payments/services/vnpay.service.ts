import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as querystring from 'querystring';
import { CreateVNPayPaymentDto, VNPayReturnDto, VNPayIPNDto } from '../dto/vnpay-payment.dto';

@Injectable()
export class VNPayService {
  private readonly logger = new Logger(VNPayService.name);
  private readonly vnpTmnCode: string;
  private readonly vnpHashSecret: string;
  private readonly vnpUrl: string;
  private readonly vnpReturnUrl: string;
  private readonly vnpApiUrl: string;

  constructor(private configService: ConfigService) {
    this.vnpTmnCode = this.configService.get<string>('VNPAY_TMN_CODE');
    this.vnpHashSecret = this.configService.get<string>('VNPAY_HASH_SECRET');
    this.vnpUrl = this.configService.get<string>('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    this.vnpReturnUrl = this.configService.get<string>('VNPAY_RETURN_URL', 'http://localhost:3000/api/v1/payments/vnpay-return');
    this.vnpApiUrl = this.configService.get<string>('VNPAY_API_URL', 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction');
  }

  /**
   * Create VNPay payment URL
   */
  createPaymentUrl(
    createVNPayPaymentDto: CreateVNPayPaymentDto,
    ipAddr: string,
  ): string {
    const { bookingId, amount, bankCode, locale = 'vn' } = createVNPayPaymentDto;

    const date = new Date();
    const createDate = this.formatDate(date);
    const orderId = `${bookingId}-${Date.now()}`;

    // VNPay requires amount in VND * 100
    const vnpAmount = amount * 100;

    let vnpParams: any = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.vnpTmnCode,
      vnp_Locale: locale,
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: `Payment for booking ${bookingId}`,
      vnp_OrderType: 'billpayment',
      vnp_Amount: vnpAmount,
      vnp_ReturnUrl: this.vnpReturnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    if (bankCode) {
      vnpParams.vnp_BankCode = bankCode;
    }

    // Sort params alphabetically
    vnpParams = this.sortObject(vnpParams);

    // Create signature
    const signData = querystring.stringify(vnpParams);
    const hmac = crypto.createHmac('sha512', this.vnpHashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    vnpParams.vnp_SecureHash = signed;

    // Build payment URL
    const paymentUrl = `${this.vnpUrl}?${querystring.stringify(vnpParams)}`;

    this.logger.log(`Created VNPay payment URL for booking ${bookingId}`);
    return paymentUrl;
  }

  /**
   * Verify VNPay return/IPN callback
   */
  verifyReturnUrl(vnpParams: VNPayReturnDto | VNPayIPNDto): {
    isValid: boolean;
    message: string;
    data?: any;
  } {
    const secureHash = vnpParams.vnp_SecureHash;
    delete vnpParams.vnp_SecureHash;
    delete vnpParams['vnp_SecureHashType'];

    // Sort params
    const sortedParams = this.sortObject(vnpParams);
    const signData = querystring.stringify(sortedParams);

    const hmac = crypto.createHmac('sha512', this.vnpHashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== signed) {
      this.logger.warn('Invalid VNPay signature');
      return {
        isValid: false,
        message: 'Invalid signature',
      };
    }

    const responseCode = vnpParams.vnp_ResponseCode;
    const transactionStatus = vnpParams.vnp_TransactionStatus;

    // Response code 00 means success
    if (responseCode === '00' && (!transactionStatus || transactionStatus === '00')) {
      this.logger.log(`VNPay payment successful: ${vnpParams.vnp_TxnRef}`);
      return {
        isValid: true,
        message: 'Payment successful',
        data: {
          orderId: vnpParams.vnp_TxnRef,
          amount: parseInt(vnpParams.vnp_Amount) / 100, // Convert back to VND
          bankCode: vnpParams.vnp_BankCode,
          bankTranNo: vnpParams.vnp_BankTranNo,
          cardType: vnpParams.vnp_CardType,
          transactionNo: vnpParams.vnp_TransactionNo,
          payDate: this.parseVNPayDate(vnpParams.vnp_PayDate),
        },
      };
    }

    const errorMessage = this.getResponseMessage(responseCode);
    this.logger.warn(`VNPay payment failed: ${errorMessage}`);
    
    return {
      isValid: true, // Signature is valid
      message: errorMessage,
      data: {
        orderId: vnpParams.vnp_TxnRef,
        responseCode,
        transactionStatus,
      },
    };
  }

  /**
   * Query transaction status from VNPay
   */
  async queryTransaction(
    txnRef: string,
    transDate: string,
  ): Promise<any> {
    const date = new Date();
    const requestId = `${date.getTime()}`;
    const createDate = this.formatDate(date);

    const data: any = {
      vnp_RequestId: requestId,
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: this.vnpTmnCode,
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Query transaction ${txnRef}`,
      vnp_TransactionDate: transDate,
      vnp_CreateDate: createDate,
      vnp_IpAddr: '127.0.0.1',
    };

    const sortedData = this.sortObject(data);
    const signData = querystring.stringify(sortedData);
    const hmac = crypto.createHmac('sha512', this.vnpHashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    data.vnp_SecureHash = signed;

    // Make API call to VNPay
    // Note: You'll need to implement HTTP client call here
    this.logger.log(`Querying VNPay transaction: ${txnRef}`);
    
    return data;
  }

  /**
   * Refund transaction
   */
  async refundTransaction(
    txnRef: string,
    amount: number,
    transDate: string,
    createBy: string,
  ): Promise<any> {
    const date = new Date();
    const requestId = `${date.getTime()}`;
    const createDate = this.formatDate(date);
    const vnpAmount = amount * 100;

    const data: any = {
      vnp_RequestId: requestId,
      vnp_Version: '2.1.0',
      vnp_Command: 'refund',
      vnp_TmnCode: this.vnpTmnCode,
      vnp_TransactionType: '02', // Full refund
      vnp_TxnRef: txnRef,
      vnp_Amount: vnpAmount,
      vnp_OrderInfo: `Refund for ${txnRef}`,
      vnp_TransactionDate: transDate,
      vnp_CreateBy: createBy,
      vnp_CreateDate: createDate,
      vnp_IpAddr: '127.0.0.1',
    };

    const sortedData = this.sortObject(data);
    const signData = querystring.stringify(sortedData);
    const hmac = crypto.createHmac('sha512', this.vnpHashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    data.vnp_SecureHash = signed;

    this.logger.log(`Refunding VNPay transaction: ${txnRef}`);
    
    return data;
  }

  /**
   * Helper: Sort object keys alphabetically
   */
  private sortObject(obj: any): any {
    const sorted: any = {};
    const keys = Object.keys(obj).sort();
    keys.forEach(key => {
      sorted[key] = obj[key];
    });
    return sorted;
  }

  /**
   * Helper: Format date to VNPay format (yyyyMMddHHmmss)
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Helper: Parse VNPay date format
   */
  private parseVNPayDate(vnpDate: string): Date {
    const year = parseInt(vnpDate.substring(0, 4));
    const month = parseInt(vnpDate.substring(4, 6)) - 1;
    const day = parseInt(vnpDate.substring(6, 8));
    const hours = parseInt(vnpDate.substring(8, 10));
    const minutes = parseInt(vnpDate.substring(10, 12));
    const seconds = parseInt(vnpDate.substring(12, 14));
    return new Date(year, month, day, hours, minutes, seconds);
  }

  /**
   * Helper: Get error message from response code
   */
  private getResponseMessage(code: string): string {
    const messages: { [key: string]: string } = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
      '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP). Xin quý khách vui lòng thực hiện lại giao dịch.',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định. Xin quý khách vui lòng thực hiện lại giao dịch',
      '99': 'Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)',
    };

    return messages[code] || 'Lỗi không xác định';
  }
}
