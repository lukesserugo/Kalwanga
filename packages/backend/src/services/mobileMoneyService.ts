// D:\Projects\Kalwanga\packages\backend\src\services\mobileMoneyService.ts

import axios from 'axios';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import * as crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

// ============================================
// INTERFACES
// ============================================

interface MTNConfig {
  apiUserId: string;
  apiKey: string;
  subscriptionKey: string;
  environment: 'sandbox' | 'production';
  baseUrl: string;
  callbackUrl: string;
  merchantCode: string;
  country: 'UG' | 'RW' | 'NG' | 'GH' | 'CM' | 'CI' | 'ZM';
  currency: string;
  apiSecret: string;
}

interface AirtelConfig {
  clientId: string;
  clientSecret: string;
  country: 'TZ' | 'KE' | 'UG' | 'GH' | 'NG' | 'RW' | 'ZM';
  baseUrl: string;
  callbackUrl: string;
  merchantCode: string;
  currency: string;
  apiKey: string;
  apiSecret: string;
}

interface MobileMoneyPaymentRequest {
  phoneNumber: string;
  amount: number;
  currency: string;
  reference: string;
  description?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

interface MobileMoneyPaymentResponse {
  transactionId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSING';
  reference: string;
  message?: string;
  data?: any;
  provider: string;
}

interface MobileMoneyTransactionStatus {
  status: string;
  reference: string;
  isSuccess: boolean;
  amount?: number;
  currency?: string;
  data?: any;
  provider: string;
}

// ============================================
// COUNTRY CONFIGURATIONS
// ============================================

const COUNTRY_CONFIGS: Record<string, { currency: string; countryCode: string; phonePrefix: string }> = {
  // MTN Countries
  UG: { currency: 'UGX', countryCode: '256', phonePrefix: '256' },
  RW: { currency: 'RWF', countryCode: '250', phonePrefix: '250' },
  NG: { currency: 'NGN', countryCode: '234', phonePrefix: '234' },
  GH: { currency: 'GHS', countryCode: '233', phonePrefix: '233' },
  CM: { currency: 'XAF', countryCode: '237', phonePrefix: '237' },
  CI: { currency: 'XOF', countryCode: '225', phonePrefix: '225' },
  ZM: { currency: 'ZMW', countryCode: '260', phonePrefix: '260' },
  // Airtel Countries
  TZ: { currency: 'TZS', countryCode: '255', phonePrefix: '255' },
  KE: { currency: 'KES', countryCode: '254', phonePrefix: '254' },
  ZA: { currency: 'ZAR', countryCode: '27', phonePrefix: '27' },
};

// ============================================
// MTN MOBILE MONEY SERVICE
// ============================================

export class MTNMobileMoneyService {
  private static instance: MTNMobileMoneyService;
  private config: MTNConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private isInitialized: boolean = false;

  private constructor() {
    const country = (process.env.MTN_COUNTRY as MTNConfig['country']) || 'UG';
    const countryConfig = COUNTRY_CONFIGS[country] || COUNTRY_CONFIGS.UG;

    this.config = {
      apiUserId: process.env.MTN_API_USER_ID || '',
      apiKey: process.env.MTN_API_KEY || '',
      subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY || '',
      environment: (process.env.MTN_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      baseUrl: process.env.MTN_BASE_URL || 'https://sandbox.momodeveloper.mtn.com',
      callbackUrl: process.env.MTN_CALLBACK_URL || 'http://localhost:3001/api/mobile-money/mtn/callback',
      merchantCode: process.env.MTN_MERCHANT_CODE || '',
      country: country,
      currency: countryConfig.currency,
      apiSecret: process.env.MTN_API_SECRET || '',
    };

    this.validateConfig();
  }

  public static getInstance(): MTNMobileMoneyService {
    if (!MTNMobileMoneyService.instance) {
      MTNMobileMoneyService.instance = new MTNMobileMoneyService();
    }
    return MTNMobileMoneyService.instance;
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    const required = ['apiUserId', 'apiKey', 'subscriptionKey'];
    const missing = required.filter(key => !this.config[key as keyof MTNConfig]);

    if (missing.length > 0) {
      logger.warn(`⚠️ Missing MTN configuration: ${missing.join(', ')}`);
      this.isInitialized = false;
    } else {
      this.isInitialized = true;
      logger.info('✅ MTN Mobile Money configured successfully');
      logger.info(`   Country: ${this.config.country}, Currency: ${this.config.currency}`);
      logger.info(`   Environment: ${this.config.environment}`);
    }
  }

  /**
   * Check if MTN Mobile Money is configured
   */
  isConfigured(): boolean {
    return this.isInitialized;
  }

  /**
   * Get base URL for MTN API
   */
  private getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Get country configuration
   */
  private getCountryConfig() {
    return COUNTRY_CONFIGS[this.config.country] || COUNTRY_CONFIGS.UG;
  }

  /**
   * Format phone number for MTN
   */
  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    const countryCode = this.getCountryConfig().countryCode;
    
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    if (cleaned.startsWith(countryCode)) {
      cleaned = cleaned.substring(countryCode.length);
    }
    
    if (!cleaned.startsWith(countryCode)) {
      cleaned = countryCode + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Get OAuth access token from MTN
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(
        `${this.config.apiUserId}:${this.config.apiKey}`
      ).toString('base64');

      const response = await axios.post(
        `${this.getBaseUrl()}/collection/token/`,
        {},
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
            'Content-Type': 'application/json',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in || 3600) * 1000;

      logger.info('✅ MTN access token obtained');
      return this.accessToken as string;
    } catch (error: any) {
      logger.error('Failed to get MTN access token:', error.response?.data || error.message);
      throw new AppError('Failed to authenticate with MTN Mobile Money', 500);
    }
  }

  /**
   * Initiate MTN Mobile Money payment
   */
  async initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResponse> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();
      const phoneNumber = this.formatPhoneNumber(request.phoneNumber);
      const reference = request.reference || `MTN-${Date.now()}`;
      const currency = request.currency || this.config.currency;

      if (request.amount <= 0) {
        throw new AppError('Amount must be positive', 400);
      }

      if (!phoneNumber || phoneNumber.length < 10) {
        throw new AppError('Invalid phone number format', 400);
      }

      const requestBody = {
        amount: request.amount.toString(),
        currency: currency,
        externalId: reference,
        payer: {
          partyIdType: 'MSISDN',
          partyId: phoneNumber,
        },
        payerMessage: request.description || 'Payment for order',
        payeeNote: request.description || 'Payment for order',
      };

      logger.info(`📱 MTN payment for ${phoneNumber} - ${request.amount} ${currency}`);

      const response = await axios.post(
        `${this.getBaseUrl()}/collection/v1_0/requesttopay`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
            'X-Reference-Id': reference,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`✅ MTN payment initiated: ${reference}`);

      return {
        transactionId: reference,
        status: 'PENDING',
        reference: reference,
        message: 'Payment initiated successfully',
        data: response.data,
        provider: 'MTN',
      };
    } catch (error: any) {
      logger.error('❌ MTN payment failed:', error.response?.data || error.message);
      
      if (error.response?.status === 400) {
        throw new AppError('Invalid request. Please check phone number and amount.', 400);
      }
      if (error.response?.status === 401) {
        throw new AppError('Authentication failed. Please check credentials.', 401);
      }
      if (error.response?.status === 403) {
        throw new AppError('Subscription key invalid or not authorized.', 403);
      }
      
      throw new AppError(
        error.response?.data?.message || 'Failed to initiate MTN payment',
        error.response?.status || 500
      );
    }
  }

  /**
   * Check MTN transaction status
   */
  async checkTransactionStatus(reference: string): Promise<MobileMoneyTransactionStatus> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.getBaseUrl()}/collection/v1_0/requesttopay/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          },
        }
      );

      const statusMap: Record<string, string> = {
        'SUCCESSFUL': 'SUCCESS',
        'PENDING': 'PENDING',
        'FAILED': 'FAILED',
      };

      const mappedStatus = statusMap[response.data.status] || response.data.status;

      return {
        status: mappedStatus,
        reference: reference,
        isSuccess: response.data.status === 'SUCCESSFUL',
        amount: parseFloat(response.data.amount),
        currency: response.data.currency,
        data: response.data,
        provider: 'MTN',
      };
    } catch (error: any) {
      logger.error('❌ MTN status check failed:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.message || 'Failed to check MTN transaction status',
        500
      );
    }
  }

  /**
   * Handle MTN callback (webhook)
   */
  handleCallback(body: any): MobileMoneyTransactionStatus {
    try {
      logger.info('📩 MTN callback received');

      const { transactionId, status, amount, currency, payer, payeeNote, financialTransactionId } = body;

      const result = {
        transactionId: transactionId || body.xReferenceId,
        status: (status || body.status) === 'SUCCESSFUL' ? 'SUCCESS' : 'PENDING',
        reference: transactionId || body.xReferenceId,
        isSuccess: (status || body.status) === 'SUCCESSFUL',
        amount: parseFloat(amount || body.amount || '0'),
        currency: currency || body.currency,
        data: { payer, payeeNote, financialTransactionId },
        provider: 'MTN',
      };

      logger.info(`✅ MTN callback processed: ${result.reference} - ${result.status}`);

      return result;
    } catch (error: any) {
      logger.error('❌ Failed to handle MTN callback:', error);
      throw new AppError('Failed to handle MTN callback', 500);
    }
  }

  /**
   * Validate MTN payment
   */
  async validatePayment(reference: string): Promise<boolean> {
    try {
      const status = await this.checkTransactionStatus(reference);
      return status.isSuccess;
    } catch (error) {
      logger.error('❌ MTN payment validation failed:', error);
      return false;
    }
  }

  /**
   * Get MTN account balance
   */
  async getAccountBalance(): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.getBaseUrl()}/collection/v1_0/account/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          },
        }
      );

      logger.info('📊 MTN balance retrieved');
      return response.data;
    } catch (error: any) {
      logger.error('❌ Failed to get MTN balance:', error.response?.data || error.message);
      throw new AppError('Failed to get MTN account balance', 500);
    }
  }

  /**
   * Validate MTN account holder
   */
  async validateAccountHolder(phoneNumber: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const response = await axios.get(
        `${this.getBaseUrl()}/account/v1/accountholders/msisdn/${formattedPhone}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          },
        }
      );

      return {
        phoneNumber: formattedPhone,
        status: response.data.status,
        isActive: response.data.status === 'ACTIVE',
        data: response.data,
      };
    } catch (error: any) {
      logger.error('❌ Account holder validation failed:', error.response?.data || error.message);
      return {
        phoneNumber: phoneNumber,
        status: 'UNKNOWN',
        isActive: false,
        error: error.response?.data?.message || 'Failed to validate account holder',
      };
    }
  }

  /**
   * Initiate MTN transfer (B2C)
   */
  async initiateTransfer(params: {
    phoneNumber: string;
    amount: number;
    currency?: string;
    reference?: string;
    reason?: string;
  }): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('MTN Mobile Money is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();
      const phoneNumber = this.formatPhoneNumber(params.phoneNumber);
      const reference = params.reference || `MTN-REF-${Date.now()}`;
      const currency = params.currency || this.config.currency;

      const requestBody = {
        amount: params.amount.toString(),
        currency: currency,
        externalId: reference,
        payee: {
          partyIdType: 'MSISDN',
          partyId: phoneNumber,
        },
        payerMessage: params.reason || 'Transfer from business',
        payeeNote: params.reason || 'Transfer from business',
      };

      logger.info(`📤 MTN transfer to ${phoneNumber} - ${params.amount} ${currency}`);

      const response = await axios.post(
        `${this.getBaseUrl()}/disbursement/v1_0/transfer`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
            'X-Reference-Id': reference,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`✅ MTN transfer initiated: ${reference}`);

      return {
        transactionId: reference,
        status: 'PENDING',
        reference: reference,
        message: 'Transfer initiated successfully',
        data: response.data,
      };
    } catch (error: any) {
      logger.error('❌ MTN transfer failed:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.message || 'Failed to initiate MTN transfer',
        500
      );
    }
  }
}

// ============================================
// AIRTEL MOBILE MONEY SERVICE
// ============================================

export class AirtelMobileMoneyService {
  private static instance: AirtelMobileMoneyService;
  private config: AirtelConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private isInitialized: boolean = false;

  private constructor() {
    const country = (process.env.AIRTEL_COUNTRY as AirtelConfig['country']) || 'UG';
    const countryConfig = COUNTRY_CONFIGS[country] || COUNTRY_CONFIGS.UG;

    this.config = {
      clientId: process.env.AIRTEL_CLIENT_ID || '',
      clientSecret: process.env.AIRTEL_CLIENT_SECRET || '',
      country: country,
      baseUrl: process.env.AIRTEL_BASE_URL || 'https://openapi.airtel.africa',
      callbackUrl: process.env.AIRTEL_CALLBACK_URL || 'http://localhost:3001/api/mobile-money/airtel/callback',
      merchantCode: process.env.AIRTEL_MERCHANT_CODE || '',
      currency: countryConfig.currency,
      apiKey: process.env.AIRTEL_API_KEY || '',
      apiSecret: process.env.AIRTEL_API_SECRET || '',
    };

    this.validateConfig();
  }

  public static getInstance(): AirtelMobileMoneyService {
    if (!AirtelMobileMoneyService.instance) {
      AirtelMobileMoneyService.instance = new AirtelMobileMoneyService();
    }
    return AirtelMobileMoneyService.instance;
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    const required = ['clientId', 'clientSecret'];
    const missing = required.filter(key => !this.config[key as keyof AirtelConfig]);

    if (missing.length > 0) {
      logger.warn(`⚠️ Missing Airtel configuration: ${missing.join(', ')}`);
      this.isInitialized = false;
    } else {
      this.isInitialized = true;
      logger.info('✅ Airtel Mobile Money configured successfully');
      logger.info(`   Country: ${this.config.country}, Currency: ${this.config.currency}`);
    }
  }

  /**
   * Check if Airtel Mobile Money is configured
   */
  isConfigured(): boolean {
    return this.isInitialized;
  }

  /**
   * Get base URL for Airtel API
   */
  private getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Get country configuration
   */
  private getCountryConfig() {
    return COUNTRY_CONFIGS[this.config.country] || COUNTRY_CONFIGS.UG;
  }

  /**
   * Format phone number for Airtel
   */
  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    const countryCode = this.getCountryConfig().countryCode;
    
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    if (cleaned.startsWith(countryCode)) {
      cleaned = cleaned.substring(countryCode.length);
    }
    
    if (!cleaned.startsWith(countryCode)) {
      cleaned = countryCode + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Get OAuth access token from Airtel
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.getBaseUrl()}/auth/oauth2/token`,
        {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'client_credentials',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in || 3600) * 1000;

      logger.info('✅ Airtel access token obtained');
      return this.accessToken as string;
    } catch (error: any) {
      logger.error('Failed to get Airtel access token:', error.response?.data || error.message);
      throw new AppError('Failed to authenticate with Airtel Mobile Money', 500);
    }
  }

  /**
   * Initiate Airtel Mobile Money payment
   */
  async initiatePayment(request: MobileMoneyPaymentRequest): Promise<MobileMoneyPaymentResponse> {
    if (!this.isConfigured()) {
      throw new AppError('Airtel Mobile Money is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();
      const phoneNumber = this.formatPhoneNumber(request.phoneNumber);
      const reference = request.reference || `AIRTEL-${Date.now()}`;
      const currency = request.currency || this.config.currency;

      if (request.amount <= 0) {
        throw new AppError('Amount must be positive', 400);
      }

      if (!phoneNumber || phoneNumber.length < 10) {
        throw new AppError('Invalid phone number format', 400);
      }

      const requestBody = {
        transaction: {
          amount: request.amount,
          currency: currency,
          id: reference,
          description: request.description || 'Payment for order',
        },
        payer: {
          type: 'MSISDN',
          msisdn: phoneNumber,
          country: this.config.country,
        },
        callback_url: request.callbackUrl || this.config.callbackUrl,
      };

      logger.info(`📱 Airtel payment for ${phoneNumber} - ${request.amount} ${currency}`);

      const response = await axios.post(
        `${this.getBaseUrl()}/merchant/v1/payments/`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Country': this.config.country,
          },
        }
      );

      const status = response.data.status === 'SUCCESS' ? 'SUCCESS' : 'PENDING';

      logger.info(`✅ Airtel payment initiated: ${reference}`);

      return {
        transactionId: response.data.data?.transaction?.id || reference,
        status: status,
        reference: reference,
        message: response.data.message || 'Payment initiated successfully',
        data: response.data,
        provider: 'AIRTEL',
      };
    } catch (error: any) {
      logger.error('❌ Airtel payment failed:', error.response?.data || error.message);
      
      if (error.response?.status === 400) {
        throw new AppError('Invalid request. Please check phone number and amount.', 400);
      }
      if (error.response?.status === 401) {
        throw new AppError('Authentication failed. Please check credentials.', 401);
      }
      
      throw new AppError(
        error.response?.data?.message || 'Failed to initiate Airtel payment',
        error.response?.status || 500
      );
    }
  }

  /**
   * Check Airtel transaction status
   */
  async checkTransactionStatus(reference: string): Promise<MobileMoneyTransactionStatus> {
    if (!this.isConfigured()) {
      throw new AppError('Airtel Mobile Money is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.getBaseUrl()}/merchant/v1/payments/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Country': this.config.country,
          },
        }
      );

      const statusMap: Record<string, string> = {
        'SUCCESS': 'SUCCESS',
        'PENDING': 'PENDING',
        'FAILED': 'FAILED',
      };

      const mappedStatus = statusMap[response.data.status] || response.data.status;

      return {
        status: mappedStatus,
        reference: reference,
        isSuccess: response.data.status === 'SUCCESS',
        amount: response.data.data?.transaction?.amount,
        currency: response.data.data?.transaction?.currency,
        data: response.data,
        provider: 'AIRTEL',
      };
    } catch (error: any) {
      logger.error('❌ Airtel status check failed:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.message || 'Failed to check Airtel transaction status',
        500
      );
    }
  }

  /**
   * Handle Airtel callback (webhook)
   */
  handleCallback(body: any): MobileMoneyTransactionStatus {
    try {
      logger.info('📩 Airtel callback received');

      const { transaction, status, data } = body;

      const result = {
        transactionId: transaction?.id || data?.transaction?.id || body.transactionId,
        status: (status || data?.status || body.status) === 'SUCCESS' ? 'SUCCESS' : 'PENDING',
        reference: transaction?.id || data?.transaction?.id || body.reference,
        isSuccess: (status || data?.status || body.status) === 'SUCCESS',
        amount: transaction?.amount || data?.transaction?.amount || body.amount,
        currency: transaction?.currency || data?.transaction?.currency || body.currency,
        data: data || body,
        provider: 'AIRTEL',
      };

      logger.info(`✅ Airtel callback processed: ${result.reference} - ${result.status}`);

      return result;
    } catch (error: any) {
      logger.error('❌ Failed to handle Airtel callback:', error);
      throw new AppError('Failed to handle Airtel callback', 500);
    }
  }

  /**
   * Validate Airtel payment
   */
  async validatePayment(reference: string): Promise<boolean> {
    try {
      const status = await this.checkTransactionStatus(reference);
      return status.isSuccess;
    } catch (error) {
      logger.error('❌ Airtel payment validation failed:', error);
      return false;
    }
  }

  /**
   * Initiate Airtel transfer (B2C)
   */
  async initiateTransfer(params: {
    phoneNumber: string;
    amount: number;
    currency?: string;
    reference?: string;
    reason?: string;
  }): Promise<any> {
    if (!this.isConfigured()) {
      throw new AppError('Airtel Mobile Money is not configured.', 503);
    }

    try {
      const token = await this.getAccessToken();
      const phoneNumber = this.formatPhoneNumber(params.phoneNumber);
      const reference = params.reference || `AIRTEL-REF-${Date.now()}`;
      const currency = params.currency || this.config.currency;

      const requestBody = {
        transaction: {
          amount: params.amount,
          currency: currency,
          id: reference,
          description: params.reason || 'Transfer from business',
        },
        payee: {
          type: 'MSISDN',
          msisdn: phoneNumber,
          country: this.config.country,
        },
        callback_url: this.config.callbackUrl,
      };

      logger.info(`📤 Airtel transfer to ${phoneNumber} - ${params.amount} ${currency}`);

      const response = await axios.post(
        `${this.getBaseUrl()}/merchant/v1/transfers/`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Country': this.config.country,
          },
        }
      );

      logger.info(`✅ Airtel transfer initiated: ${reference}`);

      return {
        transactionId: reference,
        status: 'PENDING',
        reference: reference,
        message: 'Transfer initiated successfully',
        data: response.data,
      };
    } catch (error: any) {
      logger.error('❌ Airtel transfer failed:', error.response?.data || error.message);
      throw new AppError(
        error.response?.data?.message || 'Failed to initiate Airtel transfer',
        500
      );
    }
  }
}

// ============================================
// GENERIC MOBILE MONEY SERVICE
// ============================================

export class MobileMoneyService {
  private mtnService: MTNMobileMoneyService;
  private airtelService: AirtelMobileMoneyService;

  constructor() {
    this.mtnService = MTNMobileMoneyService.getInstance();
    this.airtelService = AirtelMobileMoneyService.getInstance();
    
    logger.info('📱 Mobile Money Service initialized');
    logger.info(`   MTN: ${this.mtnService.isConfigured() ? '✅' : '❌'} Configured`);
    logger.info(`   Airtel: ${this.airtelService.isConfigured() ? '✅' : '❌'} Configured`);
  }

  /**
   * Check if any mobile money provider is configured
   */
  isConfigured(): boolean {
    return this.mtnService.isConfigured() || this.airtelService.isConfigured();
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.mtnService.isConfigured()) providers.push('MTN');
    if (this.airtelService.isConfigured()) providers.push('AIRTEL');
    return providers;
  }

  /**
   * Initiate mobile money payment with the specified provider
   */
  async initiatePayment(
    provider: 'MTN' | 'AIRTEL',
    request: MobileMoneyPaymentRequest
  ): Promise<MobileMoneyPaymentResponse> {
    if (provider === 'MTN') {
      if (!this.mtnService.isConfigured()) {
        throw new AppError('MTN Mobile Money is not configured.', 503);
      }
      return await this.mtnService.initiatePayment(request);
    } else if (provider === 'AIRTEL') {
      if (!this.airtelService.isConfigured()) {
        throw new AppError('Airtel Mobile Money is not configured.', 503);
      }
      return await this.airtelService.initiatePayment(request);
    } else {
      throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
    }
  }

  /**
   * Check transaction status
   */
  async checkStatus(provider: 'MTN' | 'AIRTEL', reference: string): Promise<MobileMoneyTransactionStatus> {
    if (provider === 'MTN') {
      return await this.mtnService.checkTransactionStatus(reference);
    } else if (provider === 'AIRTEL') {
      return await this.airtelService.checkTransactionStatus(reference);
    } else {
      throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
    }
  }

  /**
   * Handle callback
   */
  handleCallback(provider: 'MTN' | 'AIRTEL', body: any): MobileMoneyTransactionStatus {
    if (provider === 'MTN') {
      return this.mtnService.handleCallback(body);
    } else if (provider === 'AIRTEL') {
      return this.airtelService.handleCallback(body);
    } else {
      throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
    }
  }

  /**
   * Validate payment
   */
  async validatePayment(provider: 'MTN' | 'AIRTEL', reference: string): Promise<boolean> {
    if (provider === 'MTN') {
      return await this.mtnService.validatePayment(reference);
    } else if (provider === 'AIRTEL') {
      return await this.airtelService.validatePayment(reference);
    } else {
      throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
    }
  }

  /**
   * Get provider balance
   */
  async getProviderBalance(provider: 'MTN' | 'AIRTEL'): Promise<any> {
    if (provider === 'MTN') {
      return await this.mtnService.getAccountBalance();
    } else if (provider === 'AIRTEL') {
      // Airtel balance API - implement if available
      throw new AppError('Airtel balance API not implemented yet', 501);
    } else {
      throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
    }
  }

  /**
   * Validate account holder
   */
  async validateAccountHolder(provider: 'MTN' | 'AIRTEL', phoneNumber: string): Promise<any> {
    if (provider === 'MTN') {
      return await this.mtnService.validateAccountHolder(phoneNumber);
    } else if (provider === 'AIRTEL') {
      // Airtel account validation - implement if available
      throw new AppError(`Account holder validation not available for ${provider}`, 501);
    } else {
      throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
    }
  }

  /**
   * Initiate transfer (B2C)
   */
  async initiateTransfer(
    provider: 'MTN' | 'AIRTEL',
    params: {
      phoneNumber: string;
      amount: number;
      currency?: string;
      reference?: string;
      reason?: string;
    }
  ): Promise<any> {
    if (provider === 'MTN') {
      if (!this.mtnService.isConfigured()) {
        throw new AppError('MTN Mobile Money is not configured.', 503);
      }
      return await this.mtnService.initiateTransfer(params);
    } else if (provider === 'AIRTEL') {
      if (!this.airtelService.isConfigured()) {
        throw new AppError('Airtel Mobile Money is not configured.', 503);
      }
      return await this.airtelService.initiateTransfer(params);
    } else {
      throw new AppError(`Unsupported mobile money provider: ${provider}`, 400);
    }
  }
}

export const mobileMoneyService = new MobileMoneyService();
export default mobileMoneyService;
