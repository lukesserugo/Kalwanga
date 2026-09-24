// D:\Projects\Kalwanga\packages\backend\src\services\mpesaService.ts

import axios from 'axios';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';

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
      environment:
        (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') ||
        'sandbox',
      callbackUrl:
        process.env.MPESA_CALLBACK_URL ||
        'http://localhost:3001/mpesa/callback',
      resultUrl:
        process.env.MPESA_RESULT_URL ||
        'http://localhost:3001/mpesa/result',
      timeoutUrl:
        process.env.MPESA_TIMEOUT_URL ||
        'http://localhost:3001/mpesa/timeout',
    };

    if (!this.config.consumerKey) {
      logger.warn(
        '⚠️ MPESA_CONSUMER_KEY is not set. M-Pesa features will be disabled.',
      );
    }
    if (!this.config.consumerSecret) {
      logger.warn(
        '⚠️ MPESA_CONSUMER_SECRET is not set. M-Pesa features will be disabled.',
      );
    }
    if (!this.config.passkey) {
      logger.warn(
        '⚠️ MPESA_PASSKEY is not set. STK Push will fail with "Invalid Password" from Safaricom.',
      );
    }

    // A localhost callback URL cannot be reached by Safaricom. Warn
    // loudly so the failure isn't mysterious later.
    if (
      this.config.callbackUrl.includes('localhost') ||
      this.config.callbackUrl.startsWith('http://')
    ) {
      logger.warn(
        `⚠️ MPESA_CALLBACK_URL is "${this.config.callbackUrl}". ` +
          `Safaricom requires a publicly reachable HTTPS URL. ` +
          `STK Push will fail with "Invalid CallBackURL" until this points at ngrok / cloudflared / a real host.`,
      );
    }
  }

  public static getInstance(): MpesaService {
    if (!MpesaService.instance) {
      MpesaService.instance = new MpesaService();
    }
    return MpesaService.instance;
  }

  isConfigured(): boolean {
    return !!(this.config.consumerKey && this.config.consumerSecret);
  }

  private getBaseUrl(): string {
    return this.config.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(
        `${this.config.consumerKey}:${this.config.consumerSecret}`,
      ).toString('base64');

      const response = await axios.get(
        `${this.getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        },
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      logger.info('✅ M-Pesa access token obtained successfully');
      return this.accessToken as string;
    } catch (error: any) {
      logger.error(
        'Failed to get M-Pesa access token:',
        error.response?.data || error.message,
      );
      throw new AppError('Failed to authenticate with M-Pesa', 500);
    }
  }

  /**
   * Format phone number for M-Pesa.
   *
   * Accepts any of:
   *   "+254714377678"  → "254714377678"
   *   "254714377678"   → "254714377678"
   *   "0714377678"     → "254714377678"
   *   "714377678"      → "254714377678"
   */
  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }

    return cleaned;
  }

  /**
   * Generate the STK Push password.
   *
   * ⚠ Safaricom requires:
   *
   *     Password = base64( Shortcode + Passkey + Timestamp )
   *
   *   NOT SHA-256 hex, NOT MD5, NOT any other hash. This is a plain
   *   base64 encoding of a concatenated string.
   *
   * ⚠ The timestamp MUST be identical to the `Timestamp` field in
   *   the request body.
   */
  private generatePassword(
    shortcode: string,
    passkey: string,
    timestamp: string,
  ): string {
    const data = shortcode + passkey + timestamp;
    return Buffer.from(data).toString('base64');
  }

  /**
   * Get current timestamp in Safaricom's required format
   * (YYYYMMDDHHmmss).
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
   * Extract a human-readable error message from any of the three
   * error shapes Safaricom uses.
   */
  private extractSafaricomError(error: any): string {
    const data = error?.response?.data;
    return (
      data?.errorMessage ||
      data?.ResponseDescription ||
      data?.error_description ||
      error?.message ||
      'Failed to initiate M-Pesa payment'
    );
  }

  private extractSafaricomStatusCode(error: any): number {
    // Safaricom's own HTTP status is more informative than 500 when
    // it's 400 — that's a request-shape error, not a server error.
    const status = error?.response?.status;
    if (typeof status === 'number' && status >= 400 && status < 600) {
      return status;
    }
    return 500;
  }

  /**
   * Initiate STK Push (Lipa Na M-Pesa Online).
   */
  async initiateSTKPush(params: STKPushRequest): Promise<STKPushResponse> {
    if (!this.isConfigured()) {
      throw new AppError(
        'M-Pesa is not configured. Please set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.',
        503,
      );
    }

    if (!this.config.passkey) {
      throw new AppError(
        'M-Pesa is not fully configured — MPESA_PASSKEY is missing. STK Push cannot be sent.',
        503,
      );
    }

    if (!params.phoneNumber || params.phoneNumber.trim().length < 9) {
      throw new AppError('A valid phone number is required for M-Pesa.', 400);
    }

    if (!params.amount || params.amount <= 0) {
      throw new AppError(
        'A positive amount is required for M-Pesa.',
        400,
      );
    }

    // Fail fast if the callback URL cannot possibly work.
    const callbackUrl = params.callbackUrl || this.config.callbackUrl;
    if (
      callbackUrl.startsWith('http://') ||
      callbackUrl.includes('localhost') ||
      callbackUrl.includes('127.0.0.1')
    ) {
      throw new AppError(
        `MPESA_CALLBACK_URL must be a publicly reachable HTTPS URL. ` +
          `Current value: "${callbackUrl}". ` +
          `Expose your backend via ngrok / cloudflared and set MPESA_CALLBACK_URL to the HTTPS URL.`,
        503,
      );
    }

    try {
      const token = await this.getAccessToken();
      const phoneNumber = this.formatPhoneNumber(params.phoneNumber);

      // ⚠ Compute the timestamp ONCE. Both the Password and the
      //   Timestamp field in the request body must use the same
      //   value, or Safaricom returns "Invalid Password".
      const timestamp = this.getTimestamp();
      const password = this.generatePassword(
        this.config.shortcode,
        this.config.passkey,
        timestamp,
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
        CallBackURL: callbackUrl,
        AccountReference:
          params.accountReference || `ORDER-${Date.now()}`,
        TransactionDesc: params.transactionDesc || 'Payment for order',
      };

      logger.info(
        `Initiating STK Push for ${phoneNumber} - ${params.amount} KES`,
      );

      const response = await axios.post(
        `${this.getBaseUrl()}/mpesa/stkpush/v1/processrequest`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Safaricom returns 200 with ResponseCode '0' on success,
      // and 200 with a non-zero ResponseCode on some errors too.
      // Check both.
      if (
        response.data?.ResponseCode &&
        response.data.ResponseCode !== '0'
      ) {
        logger.error(
          `STK Push returned non-zero ResponseCode: ${response.data.ResponseCode} - ${response.data.ResponseDescription}`,
        );
        throw new AppError(
          response.data.ResponseDescription ||
            'M-Pesa rejected the STK push request',
          502,
        );
      }

      logger.info(
        `STK Push initiated: ${response.data.CheckoutRequestID}`,
      );

      return response.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      const safaricomError = this.extractSafaricomError(error);
      const statusCode = this.extractSafaricomStatusCode(error);

      logger.error('STK Push failed:', {
        message: error.message,
        safaricomResponse: error.response?.data,
        statusCode,
      });

      throw new AppError(safaricomError, statusCode);
    }
  }

  async queryTransactionStatus(
    params: TransactionStatusRequest,
  ): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('M-Pesa is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = this.generatePassword(
        params.shortcode || this.config.shortcode,
        this.config.passkey,
        timestamp,
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
        },
      );

      return response.data;
    } catch (error: any) {
      const safaricomError = this.extractSafaricomError(error);
      const statusCode = this.extractSafaricomStatusCode(error);

      logger.error('Transaction status query failed:', {
        message: error.message,
        safaricomResponse: error.response?.data,
        statusCode,
      });

      throw new AppError(safaricomError, statusCode);
    }
  }

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

      logger.info(
        `M-Pesa callback received: ${result.checkoutRequestId} - ${result.resultDesc}`,
      );

      return result;
    } catch (error: any) {
      logger.error('Failed to handle M-Pesa callback:', error);
      throw new AppError('Failed to handle callback', 500);
    }
  }

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

    // ─── Added: input validation parity with initiateSTKPush ─────
    if (!params.phoneNumber || params.phoneNumber.trim().length < 9) {
      throw new AppError(
        'A valid phone number is required for M-Pesa B2C.',
        400,
      );
    }

    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new AppError(
        'A positive, finite amount is required for M-Pesa B2C.',
        400,
      );
    }
    // ─────────────────────────────────────────────────────────────

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
        },
      );

      logger.info(`B2C payment initiated: ${response.data.ConversationID}`);
      return response.data;
    } catch (error: any) {
      logger.error('B2C payment failed:', error.response?.data || error.message);
      throw new AppError(this.extractSafaricomError(error), 500);
    }
  }

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
        },
      );

      logger.info('C2B URL registered successfully');
      return response.data;
    } catch (error: any) {
      logger.error(
        'C2B URL registration failed:',
        error.response?.data || error.message,
      );
      throw new AppError('Failed to register C2B URL', 500);
    }
  }
}

export const mpesaService = MpesaService.getInstance();
export default mpesaService;
