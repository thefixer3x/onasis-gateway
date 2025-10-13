/**
 * Providus Bank Account Services Client
 * Corporate account management - balance inquiry, transaction history, account validation
 */

import axios, { AxiosInstance } from 'axios';
import type {
  AccountBalance,
  ValidateAccountRequest,
  ValidateAccountResponse,
  TransactionHistoryRequest,
  TransactionHistoryResponse,
  StatementRequest,
  StatementResponse,
  TransactionStatus,
  AccountClientConfig,
  ProvidusAccountServiceResponse,
  AccountServiceError,
  HealthCheckResponse,
  ServiceStats
} from './types';
import { NIGERIAN_BANK_CODES } from './types';

export class ProvidusBankAccountClient {
  private client: AxiosInstance;
  private config: AccountClientConfig;
  private stats: ServiceStats;

  constructor(config: AccountClientConfig) {
    this.config = config;
    this.stats = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      startTime: Date.now(),
      averageResponseTime: 0
    };

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  // ================== Account Balance ==================

  /**
   * Get current balance for corporate account
   * @param accountNumber - Optional account number (uses default if not provided)
   * @returns Promise<AccountBalance>
   */
  async getBalance(accountNumber?: string): Promise<AccountBalance> {
    try {
      const account = accountNumber || this.config.accountNumber;
      const response = await this.client.get(`/account/balance/${account}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get account balance');
    }
  }

  // ================== Account Validation ==================

  /**
   * Validate beneficiary account before transfer
   * @param request - Account validation request
   * @returns Promise<ValidateAccountResponse>
   */
  async validateAccount(request: ValidateAccountRequest): Promise<ValidateAccountResponse> {
    try {
      // Validate bank code format
      if (!this.isValidBankCode(request.bankCode)) {
        throw this.createError('Invalid bank code format', 'INVALID_BANK_CODE');
      }

      const response = await this.client.post('/account/validate', request);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to validate account');
    }
  }

  // ================== Transaction History ==================

  /**
   * Get transaction history for account with pagination
   * @param request - Transaction history request
   * @returns Promise<TransactionHistoryResponse>
   */
  async getTransactionHistory(request: TransactionHistoryRequest): Promise<TransactionHistoryResponse> {
    try {
      // Validate date format
      this.validateDateFormat(request.startDate);
      this.validateDateFormat(request.endDate);

      // Validate date range
      if (new Date(request.startDate) > new Date(request.endDate)) {
        throw this.createError('Start date cannot be after end date', 'INVALID_DATE_RANGE');
      }

      const params = {
        accountNumber: request.accountNumber,
        startDate: request.startDate,
        endDate: request.endDate,
        page: request.page || 1,
        limit: Math.min(request.limit || 50, 100), // Max 100 per page
        type: request.type || 'ALL',
      };

      const response = await this.client.get('/account/transactions', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get transaction history');
    }
  }

  // ================== Account Statement ==================

  /**
   * Generate account statement for date range
   * @param request - Statement generation request
   * @returns Promise<StatementResponse>
   */
  async generateStatement(request: StatementRequest): Promise<StatementResponse> {
    try {
      // Validate date format
      this.validateDateFormat(request.startDate);
      this.validateDateFormat(request.endDate);

      // Validate date range
      if (new Date(request.startDate) > new Date(request.endDate)) {
        throw this.createError('Start date cannot be after end date', 'INVALID_DATE_RANGE');
      }

      // Validate format
      if (!['PDF', 'CSV', 'JSON'].includes(request.format)) {
        throw this.createError('Invalid statement format', 'INVALID_FORMAT');
      }

      const response = await this.client.post('/account/statement', request);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to generate account statement');
    }
  }

  // ================== Transaction Status ==================

  /**
   * Check status of specific transaction by reference
   * @param reference - Transaction reference number
   * @returns Promise<TransactionStatus>
   */
  async getTransactionStatus(reference: string): Promise<TransactionStatus> {
    try {
      if (!reference || reference.trim().length === 0) {
        throw this.createError('Transaction reference is required', 'MISSING_REFERENCE');
      }

      const response = await this.client.get(`/transaction/status/${reference}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get transaction status');
    }
  }

  // ================== Utility Methods ==================

  /**
   * Get list of supported Nigerian bank codes
   * @returns Record<string, BankCode>
   */
  getSupportedBankCodes(): Record<string, any> {
    return NIGERIAN_BANK_CODES;
  }

  /**
   * Validate if bank code is supported
   * @param bankCode - Bank code to validate
   * @returns boolean
   */
  isValidBankCode(bankCode: string): boolean {
    return bankCode in NIGERIAN_BANK_CODES;
  }

  /**
   * Get bank name by code
   * @param bankCode - Bank code
   * @returns string | undefined
   */
  getBankName(bankCode: string): string | undefined {
    return NIGERIAN_BANK_CODES[bankCode]?.name;
  }

  /**
   * Health check for the service
   * @returns Promise<HealthCheckResponse>
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    try {
      // Test API connectivity with a simple call
      const response = await this.client.get('/health');
      
      return {
        status: 'healthy',
        service: 'providus-bank-account',
        timestamp: new Date().toISOString(),
        api_connectivity: response.status === 200,
        last_successful_request: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'providus-bank-account',
        timestamp: new Date().toISOString(),
        api_connectivity: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get service statistics
   * @returns ServiceStats
   */
  getStats(): ServiceStats {
    const uptime = Date.now() - this.stats.startTime;
    return {
      ...this.stats,
      averageResponseTime: this.stats.requestCount > 0 
        ? this.stats.totalResponseTime / this.stats.requestCount 
        : 0
    };
  }

  // ================== Private Methods ==================

  private setupInterceptors(): void {
    // Request interceptor to inject auth token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const token = await this.config.getAuthToken();
          if (token) {
            config.headers['X-Access-Token'] = token;
          }
        } catch (error) {
          console.warn('[ProvidusAccount] Failed to get auth token:', error);
        }
        
        console.log(`[ProvidusAccount] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for logging and stats
    this.client.interceptors.response.use(
      (response) => {
        this.stats.requestCount++;
        this.stats.lastRequest = new Date().toISOString();
        return response;
      },
      (error) => {
        this.stats.errorCount++;
        this.stats.lastRequest = new Date().toISOString();
        console.error(`[ProvidusAccount] Request failed:`, error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  private validateDateFormat(date: string): void {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw this.createError('Invalid date format. Use YYYY-MM-DD', 'INVALID_DATE_FORMAT');
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw this.createError('Invalid date', 'INVALID_DATE');
    }
  }

  private createError(message: string, code: string, status?: number): AccountServiceError {
    const error = new Error(message) as AccountServiceError;
    error.code = code;
    error.status = status;
    return error;
  }

  private handleError(error: unknown, context: string): AccountServiceError {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      const status = error.response?.status;
      const code = error.response?.data?.code || 'API_ERROR';
      
      const accountError = this.createError(
        `${context}: ${message}`,
        code,
        status
      );
      
      accountError.details = error.response?.data;
      return accountError;
    }

    if (error instanceof Error) {
      return this.createError(`${context}: ${error.message}`, 'UNKNOWN_ERROR');
    }

    return this.createError(`${context}: Unknown error occurred`, 'UNKNOWN_ERROR');
  }

  // ================== Response Formatting ==================

  /**
   * Format response in standard format
   * @param operation - Operation name
   * @param data - Response data
   * @returns ProvidusAccountServiceResponse
   */
  formatResponse<T>(operation: string, data: T): ProvidusAccountServiceResponse<T> {
    return {
      success: true,
      operation,
      data,
      timestamp: new Date().toISOString(),
      service_provider: this.config.mode === 'sandbox' ? {
        client_id: 'sandbox'
      } : undefined
    };
  }
}

// Factory function
export function createAccountClient(config: AccountClientConfig): ProvidusBankAccountClient {
  return new ProvidusBankAccountClient(config);
}

export type { AccountClientConfig };
export default ProvidusBankAccountClient;