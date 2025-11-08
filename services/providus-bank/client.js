// services/providus-bank/client.js - Compiled version for PM2
const axios = require('axios');

class ProvidusBankClient {
  constructor(config) {
    this.config = config;
    this.tokens = null;
    this.refreshPromise = null;
    
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

  setupInterceptors() {
    // Request interceptor for token injection
    this.client.interceptors.request.use(
      async (config) => {
        if (this.tokens && this.isTokenExpired()) {
          await this.refreshTokens();
        }

        if (this.tokens) {
          config.headers = config.headers || {};
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
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await this.refreshTokens();
            return this.client(originalRequest);
          } catch (refreshError) {
            this.tokens = null;
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async authenticate(email, password) {
    try {
      const authEmail = email || this.config.email;
      const authPassword = password || this.config.password;

      if (!authEmail || !authPassword) {
        throw new Error('Email and password are required for authentication');
      }

      const encodedEmail = Buffer.from(authEmail).toString('base64');
      const encodedPassword = Buffer.from(authPassword).toString('base64');

      const response = await this.client.post('/auth/login', {
        email: encodedEmail,
        password: encodedPassword,
      });

      const accessToken = response.headers['x-access-token'];
      const refreshToken = response.headers['x-refresh-token'];

      if (!accessToken || !refreshToken) {
        throw new Error('Authentication successful but tokens not received');
      }

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

  async refreshTokens() {
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

  isTokenExpired() {
    if (!this.tokens) return true;
    return Date.now() >= (this.tokens.expiresAt - 300000);
  }

  async getUserProfile() {
    try {
      const response = await this.client.get('/user/profile');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to get user profile');
    }
  }

  async nipFundTransfer(params) {
    try {
      const requestData = {
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

  async nipMultiDebitTransfer(params) {
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

  async healthCheck() {
    try {
      await this.getUserProfile();
      return true;
    } catch (error) {
      return false;
    }
  }

  handleError(error, context) {
    if (error.response?.data?.message) {
      return new Error(`${context}: ${error.response.data.message} (Status: ${error.response.status})`);
    }
    
    if (error.message) {
      return new Error(`${context}: ${error.message}`);
    }
    
    return new Error(`${context}: Unknown error occurred`);
  }

  isAuthenticated() {
    return this.tokens !== null && !this.isTokenExpired();
  }

  getTokens() {
    return this.tokens;
  }

  setTokens(tokens) {
    this.tokens = tokens;
  }

  getMode() {
    return this.config.mode.toUpperCase();
  }
}

function createProvidusClient(config) {
  return new ProvidusBankClient(config);
}

module.exports = {
  ProvidusBankClient,
  createProvidusClient,
};