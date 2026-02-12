/**
 * Shared types for Edge Functions
 */

export interface EdgeFunctionRequest {
  action: string;
  [key: string]: any;
}

export interface EdgeFunctionResponse {
  success: boolean;
  data?: any;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  timestamp: string;
}

export interface VendorConfig {
  apiKey: string;
  baseURL: string;
  headers?: Record<string, string>;
}
