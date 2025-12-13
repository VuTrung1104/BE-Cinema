import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateVNPayPaymentDto {
  @IsNotEmpty()
  @IsString()
  bookingId: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  bankCode?: string; // NCB, VNPAYQR, etc.

  @IsOptional()
  @IsString()
  locale?: string; // vn or en
}

export class VNPayReturnDto {
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_BankTranNo: string;
  vnp_CardType: string;
  vnp_OrderInfo: string;
  vnp_PayDate: string;
  vnp_ResponseCode: string;
  vnp_TmnCode: string;
  vnp_TransactionNo: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHash: string;
}

export class VNPayIPNDto extends VNPayReturnDto {
  vnp_SecureHashType?: string;
}
