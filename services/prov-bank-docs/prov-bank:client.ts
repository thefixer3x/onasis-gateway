// services/providus-bank/client.ts
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';

// Extend AxiosRequestConfig to include our retry flag
interface RetryableAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

interface PBAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface PBAuthResponse {
  status: boolean;
  data: {
    id: string;
    role: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    MerchantId: string;
    Merchant: {
      id: string;
      email: string;
      businessName: string;
      mode: 'SANDBOX' | 'PRODUCTION';
    };
  };
  permissions: string[];
}

interface NIPTransferRequest {
  beneficiaryAccountName: string;
  transactionAmount: string;
  currencyCode: 'NGN';
  narration: string;
  sourceAccountName: string;
  beneficiaryAccountNumber: string;
  beneficiaryBank: string;
  transactionReference: string;
  userName: string;
  password: string;
}

interface PBClientConfig {
  baseUrl: string;
  username: string;
  password: string;
  email?: string;
  mode: 'sandbox' | 'production';
}

export class ProvidusBankClient {
  private client: AxiosInstance;
  private tokens: PBAuthTokens | null = null;
  private config: PBClientConfig;
  private refreshPromise: Promise<void> | null = null;

  constructor(config: PBClientConfig) {
    this.config = config;
    
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for token injection
    this.client.interceptors.request.use(
      async (config) => {
        // Check if tokens exist and are valid
        if (this.tokens && this.isTokenExpired()) {
          await this.refreshTokens();
        }

        // Add tokens to headers if available
        if (this.tokens) {
          config.headers['X-Access-Token'] = this.tokens.accessToken;
          config.headers['X-Refresh-Token'] = this.tokens.refreshToken;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for token refresh on 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as RetryableAxiosRequestConfig;

        // If 401 and not already retried, refresh token
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await this.refreshTokens();
            return this.client(originalRequest);
          } catch (refreshError) {
            // Token refresh failed, clear tokens and re-authenticate
            this.tokens = null;
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // ================== Authentication ==================

  async authenticate(email?: string, password?: string): Promise<PBAuthResponse> {
    try {
      const authEmail = email || this.config.email;
      const authPassword = password || this.config.password;

      if (!authEmail || !authPassword) {
        throw new Error('Email and password are required for authentication');
      }

      // Encode credentials to base64 as per API requirements
      const encodedEmail = Buffer.from(authEmail).toString('base64');
      const encodedPassword = Buffer.from(authPassword).toString('base64');

      const response = await this.client.post<PBAuthResponse>('/auth/login', {
        email: encodedEmail,
        password: encodedPassword,
      });

      // Extract tokens from response headers
      const accessToken = response.headers['x-access-token'];
      const refreshToken = response.headers['x-refresh-token'];

      if (!accessToken || !refreshToken) {
        throw new Error('Authentication successful but tokens not received');
      }

      // Store tokens with expiry (default 1 hour)
      this.tokens = {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + 3600000, // 1 hour
      };

      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Authentication failed');
    }
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
      this.tokens = null;
    } catch (error) {
      throw this.handleError(error, 'Logout failed');
    }
  }

  async refreshTokens(): Promise<void> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        if (!this.tokens?.refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await this.client.post('/auth/refresh/token', {}, {
          headers: {
            'X-Refresh-Token': this.tokens.refreshToken,
          },
        });

        // Extract new tokens from headers
        const accessToken = response.headers['x-access-token'];
        const refreshToken = response.headers['x-refresh-token'];

        if (accessToken && refreshToken) {
          this.tokens = {
            accessToken,
            refreshToken,
            expiresAt: Date.now() + 3600000,
          };
        }
      } catch (error) {
        this.tokens = null;
        throw this.handleError(error, 'Token refresh failed');
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private isTokenExpired(): boolean {
    if (!this.tokens) return true;
    // Refresh 5 minutes before expiry
    return Date.now() >= (this.tokens.expiresAt - 300000);
  }

  // ================== User Management ==================

  async getUserProfile(): Promise<PBAuthResponse> {
    try {
      const response = await this.client.get<PBAuthResponse>('/user/profile');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user profile');
    }
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<{ status: boolean; message: string }> {
    try {
      const response = await this.client.post('/user/password', {
        currentPassword,
        newPassword,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to update password');
    }
  }

  // ================== Transfer Operations ==================

  async nipFundTransfer(params: Omit<NIPTransferRequest, 'userName' | 'password'>): Promise<any> {
    try {
      const requestData: NIPTransferRequest = {
        ...params,
        userName: this.config.username,
        password: this.config.password,
        currencyCode: 'NGN',
      };

      const response = await this.client.post('/NIPFundTransfer', requestData);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'NIP fund transfer failed');
    }
  }

  async nipMultiDebitTransfer(params: {
    beneficiaryAccountName: string;
    transactionAmount: string;
    narration: string;
    debitAccount: string;
    sourceAccountName: string;
    beneficiaryAccountNumber: string;
    beneficiaryBank: string;
    transactionReference: string;
  }): Promise<any> {
    try {
      const requestData = {
        ...params,
        currencyCode: 'NGN',
        userName: this.config.username,
        password: this.config.password,
      };

      const response = await this.client.post('/NIPFundTransferMultipleDebitAccounts', requestData);
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Multi-debit transfer failed');
    }
  }

  // ================== Health Check ==================

  async healthCheck(): Promise<boolean> {
    try {
      // Use user profile as health check if no dedicated endpoint
      await this.getUserProfile();
      return true;
    } catch (error) {
      return false;
    }
  }

  // ================== Error Handling ==================

  private handleError(error: unknown, context: string): Error {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      const status = error.response?.status;
      
      return new Error(`${context}: ${message} (Status: ${status || 'Unknown'})`);
    }
    
    if (error instanceof Error) {
      return new Error(`${context}: ${error.message}`);
    }
    
    return new Error(`${context}: Unknown error occurred`);
  }

  // ================== Utility Methods ==================

  isAuthenticated(): boolean {
    return this.tokens !== null && !this.isTokenExpired();
  }

  getTokens(): PBAuthTokens | null {
    return this.tokens;
  }

  setTokens(tokens: PBAuthTokens): void {
    this.tokens = tokens;
  }

  getMode(): 'SANDBOX' | 'PRODUCTION' {
    return this.config.mode.toUpperCase() as 'SANDBOX' | 'PRODUCTION';
  }
}

// Factory function for easy instantiation
export function createProvidusClient(config: PBClientConfig): ProvidusBankClient {
  return new ProvidusBankClient(config);
}

// Type exports
export type {
  PBAuthTokens,
  PBAuthResponse,
  NIPTransferRequest,
  PBClientConfig,
};