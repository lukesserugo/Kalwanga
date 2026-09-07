// D:\Projects\Kalwanga\packages\backend\src\services\mpesaService.ts

import axios from 'axios';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import * as crypto from 'crypto';

interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  environment: 'sandbox' | 'production';
  callbackUrl: string;
  resultUrl: string;
  timeoutUrl: string;
}

interface STKPushRequest {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc?: string;
  callbackUrl?: string;
}

interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

interface TransactionStatusRequest {
  transactionId: string;
  shortcode: string;
}

export class MpesaService {
  private static instance: MpesaService;
  private config: MpesaConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private constructor() {
    this.config = {
      consumerKey: process.env.MPESA_CONSUMER_KEY || '',
      consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
      passkey: process.env.MPESA_PASSKEY || '',
      shortcode: process.env.MPESA_SHORTCODE || '174379',
      environment: (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      callbackUrl: process.env.MPESA_CALLBACK_URL || 'http://localhost:3001/api/mpesa/callback',
      resultUrl: process.env.MPESA_RESULT_URL || 'http://localhost:3001/api/mpesa/result',
      timeoutUrl: process.env.MPESA_TIMEOUT_URL || 'http://localhost:3001/api/mpesa/timeout',
    };

    // Validate config
    if (!this.config.consumerKey) {
      logger.warn('⚠️ MPESA_CONSUMER_KEY is not set. M-Pesa features will be disabled.');
    }
    if (!this.config.consumerSecret) {
      logger.warn('⚠️ MPESA_CONSUMER_SECRET is not set. M-Pesa features will be disabled.');
    }
  }

  public static getInstance(): MpesaService {
    if (!MpesaService.instance) {
      MpesaService.instance = new MpesaService();
    }
    return MpesaService.instance;
  }

  /**
   * Check if M-Pesa is configured
   */
  isConfigured(): boolean {
    return !!(this.config.consumerKey && this.config.consumerSecret);
  }

  /**
   * Get the base URL for M-Pesa API
   */
  private getBaseUrl(): string {
    return this.config.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if token is still valid (with 60 second buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(
        `${this.config.consumerKey}:${this.config.consumerSecret}`
      ).toString('base64');

      const response = await axios.get(
        `${this.getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      logger.info('✅ M-Pesa access token obtained successfully');
      return this.accessToken;
    } catch (error: any) {
      logger.error('Failed to get M-Pesa access token:', error.response?.data || error.message);
      throw new AppError('Failed to authenticate with M-Pesa', 500);
    }
  }

  /**
   * Format phone number for M-Pesa (remove leading 0 or +254)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Remove leading 0 or +254
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.startsWith('254')) {
      cleaned = cleaned.substring(3);
    }
    
    // Ensure it starts with 254
    if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Generate password for STK Push
   */
  private generatePassword(shortcode: string, passkey: string): string {
    const timestamp = this.getTimestamp();
    const data = shortcode + passkey + timestamp;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return hash;
  }

  /**
   * Get current timestamp in required format (YYYYMMDDHHmmss)
   */
  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Initiate STK Push (Lipa Na M-Pesa Online)
   */
  async initiateSTKPush(params: STKPushRequest): Promise<STKPushResponse> {
    if (!this.isConfigured()) {
      throw new AppError('M-Pesa is not configured. Please set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.', 503);
    }

    try {
      const token = await this.getAccessToken();
      const phoneNumber = this.formatPhoneNumber(params.phoneNumber);
      const timestamp = this.getTimestamp();
      const password = this.generatePassword(
        this.config.shortcode,
        this.config.passkey
      );

      const requestBody = {
        BusinessShortCode: this.config.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(params.amount),
        PartyA: phoneNumber,
        PartyB: this.config.shortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: params.callbackUrl || this.config.callbackUrl,
        AccountReference: params.accountReference || `ORDER-${Date.now()}`,
        TransactionDesc: params.transactionDesc || 'Payment for order',
      };

      logger.info(`Initiating STK Push for ${phoneNumber} - ${params.amount}`);

      const response = await axios.post(
        `${this.getBaseUrl()}/mpesa/stkpush/v1/processrequest`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`STK Push initiated: ${response.data.CheckoutRequestID}`);

      return response.data;
    } catch (error: any) {
      logger.error('STK Push failed:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.ResponseDescription || 'Failed to initiate M-Pesa payment',
        500
      );
    }
  }

  /**
   * Query transaction status
   */
  async queryTransactionStatus(params: TransactionStatusRequest): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('M-Pesa is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = this.generatePassword(
        params.shortcode || this.config.shortcode,
        this.config.passkey
      );

      const requestBody = {
        BusinessShortCode: params.shortcode || this.config.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: params.transactionId,
      };

      const response = await axios.post(
        `${this.getBaseUrl()}/mpesa/stkpushquery/v1/query`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Transaction status query failed:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.ResponseDescription || 'Failed to query transaction status',
        500
      );
    }
  }

  /**
   * Handle STK Push callback (webhook)
   */
  async handleSTKPushCallback(body: any): Promise<any> {
    try {
      const { Body } = body;

      if (!Body) {
        throw new AppError('Invalid callback payload', 400);
      }

      const { stkCallback } = Body;

      const result = {
        merchantRequestId: stkCallback.MerchantRequestID,
        checkoutRequestId: stkCallback.CheckoutRequestID,
        resultCode: stkCallback.ResultCode,
        resultDesc: stkCallback.ResultDesc,
        isSuccess: stkCallback.ResultCode === '0',
        callbackMetadata: stkCallback.CallbackMetadata?.Item || [],
      };

      logger.info(`M-Pesa callback received: ${result.checkoutRequestId} - ${result.resultDesc}`);

      return result;
    } catch (error: any) {
      logger.error('Failed to handle M-Pesa callback:', error);
      throw new AppError('Failed to handle callback', 500);
    }
  }

  /**
   * Process B2C Payment (Business to Customer)
   */
  async processB2CPayment(params: {
    phoneNumber: string;
    amount: number;
    commandId: 'BusinessPayment' | 'SalaryPayment' | 'PromotionPayment';
    remarks: string;
    occasion?: string;
  }): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('M-Pesa is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();
      const phoneNumber = this.formatPhoneNumber(params.phoneNumber);

      const requestBody = {
        InitiatorName: process.env.MPESA_INITIATOR_NAME,
        SecurityCredential: process.env.MPESA_INITIATOR_PASSWORD,
        CommandID: params.commandId,
        Amount: Math.round(params.amount),
        PartyA: this.config.shortcode,
        PartyB: phoneNumber,
        Remarks: params.remarks || 'Payment',
        QueueTimeOutURL: this.config.timeoutUrl,
        ResultURL: this.config.resultUrl,
        Occasion: params.occasion || 'Payment',
      };

      const response = await axios.post(
        `${this.getBaseUrl()}/mpesa/b2c/v1/paymentrequest`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`B2C payment initiated: ${response.data.ConversationID}`);
      return response.data;
    } catch (error: any) {
      logger.error('B2C payment failed:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.ResponseDescription || 'Failed to process B2C payment',
        500
      );
    }
  }

  /**
   * Process C2B Payment (Customer to Business) - Register URL
   */
  async registerC2BURL(): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('M-Pesa is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();

      const requestBody = {
        ShortCode: this.config.shortcode,
        ResponseType: 'Completed',
        ConfirmationURL: this.config.callbackUrl,
        ValidationURL: this.config.callbackUrl,
      };

      const response = await axios.post(
        `${this.getBaseUrl()}/mpesa/c2b/v1/registerurl`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('C2B URL registered successfully');
      return response.data;
    } catch (error: any) {
      logger.error('C2B URL registration failed:', error.response?.data || error.message);
      throw new AppError('Failed to register C2B URL', 500);
    }
  }
}

export const mpesaService = MpesaService.getInstance();
export default mpesaService;
