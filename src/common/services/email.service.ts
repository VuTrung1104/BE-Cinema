import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('EMAIL_PORT', 587),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
  }

  async sendOTP(email: string, otp: string, type: string) {
    const subject = type === 'register' 
      ? 'Verify Your Email - BE Cinema'
      : 'Reset Your Password - BE Cinema';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { color: #e74c3c; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎬 BE Cinema</h1>
            <p>${type === 'register' ? 'Email Verification' : 'Password Reset'}</p>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>${type === 'register' 
              ? 'Thank you for registering with BE Cinema! Please use the OTP code below to verify your email address:' 
              : 'We received a request to reset your password. Use the OTP code below to proceed:'
            }</p>
            
            <div class="otp-box">
              <p style="margin: 0; color: #666;">Your OTP Code:</p>
              <div class="otp-code">${otp}</div>
              <p style="margin: 10px 0 0 0; color: #666;">Valid for 10 minutes</p>
            </div>

            <p>If you didn't request this code, please ignore this email.</p>
            <p class="warning">⚠️ Never share this code with anyone. BE Cinema staff will never ask for your OTP.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} BE Cinema. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"BE Cinema" <${this.configService.get<string>('EMAIL_USER')}>`,
        to: email,
        subject: subject,
        html: html,
      });

      this.logger.log(`OTP email sent successfully to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}:`, error);
      throw new Error('Failed to send email');
    }
  }

  async sendAccountLockedNotification(email: string, reason: string, lockUntil: Date) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #e74c3c; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert-box { background: #fff3cd; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Account Locked</h1>
          </div>
          <div class="content">
            <p>Dear User,</p>
            <p>Your BE Cinema account has been temporarily locked.</p>
            
            <div class="alert-box">
              <strong>Reason:</strong> ${reason}<br>
              <strong>Lock Until:</strong> ${lockUntil.toLocaleString()}
            </div>

            <p>If you believe this is an error, please contact our support team.</p>
            <p><strong>Support Email:</strong> support@becinema.com</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} BE Cinema. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"BE Cinema" <${this.configService.get<string>('EMAIL_USER')}>`,
        to: email,
        subject: 'Account Locked - BE Cinema',
        html: html,
      });

      this.logger.log(`Account locked notification sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send lock notification to ${email}:`, error);
      return false;
    }
  }
}
