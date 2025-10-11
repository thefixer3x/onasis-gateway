/**
 * TypeScript interfaces for Providus Bank Account Services
 * Corporate account management - balance inquiry, transaction history, account validation
 */

export interface AccountBalance {
  accountNumber: string;
  accountName: string;
  availableBalance: string;
  ledgerBalance: string;
  currency: 'NGN';
  status: 'ACTIVE' | 'INACTIVE' | 'FROZEN';
  lastTransactionDate: string;
}

export interface ValidateAccountRequest {
  accountNumber: string;
  bankCode: string;
}

export interface ValidateAccountResponse {
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  isValid: boolean;
  bvnLinked: boolean;
}

export interface TransactionHistoryRequest {
  accountNumber: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  page?: number;
  limit?: number;
  type?: 'CREDIT' | 'DEBIT' | 'ALL';
}

export interface Transaction {
  id: string;
  reference: string;
  type: 'CREDIT' | 'DEBIT';
  amount: string;
  currency: 'NGN';
  narration: string;
  balanceAfter: string;
  transactionDate: string;
  valueDate: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  counterparty?: {
    accountNumber: string;
    accountName: string;
    bankCode?: string;
  };
}

export interface TransactionHistoryResponse {
  accountNumber: string;
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface StatementRequest {
  accountNumber: string;
  startDate: string;
  endDate: string;
  format: 'PDF' | 'CSV' | 'JSON';
  email?: string; // Optional: email statement
}

export interface StatementResponse {
  statementId: string;
  accountNumber: string;
  period: {
    from: string;
    to: string;
  };
  openingBalance: string;
  closingBalance: string;
  totalCredits: string;
  totalDebits: string;
  transactionCount: number;
  downloadUrl?: string;
  data?: Transaction[]; // If format is JSON
}

export interface TransactionStatus {
  reference: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REVERSED';
  amount: string;
  narration: string;
  initiatedAt: string;
  completedAt?: string;
  failureReason?: string;
}

export interface AccountClientConfig {
  baseUrl: string;
  username: string;
  password: string;
  accountNumber: string;
  mode: 'sandbox' | 'production';
  getAuthToken: () => Promise<string>; // Get token from main Providus client
}

export interface ProvidusAccountServiceResponse<T = any> {
  success: boolean;
  operation: string;
  data?: T;
  error?: {
    message: string;
    code: string;
    status?: number;
  };
  timestamp: string;
  service_provider?: {
    client_id?: string;
  };
}

export interface BankCode {
  code: string;
  name: string;
  country: string;
}

export interface AccountValidationError {
  code: 'INVALID_ACCOUNT' | 'INVALID_BANK_CODE' | 'ACCOUNT_NOT_FOUND' | 'BANK_NOT_SUPPORTED';
  message: string;
  details?: any;
}

export interface TransactionFilter {
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  type?: 'CREDIT' | 'DEBIT' | 'ALL';
  status?: 'COMPLETED' | 'PENDING' | 'FAILED';
  reference?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'amount' | 'reference';
  sortOrder?: 'asc' | 'desc';
}

export interface StatementOptions {
  includePending?: boolean;
  groupBy?: 'day' | 'week' | 'month';
  includeCharges?: boolean;
  includeReversals?: boolean;
}

export interface AccountServiceError extends Error {
  code: string;
  status?: number;
  details?: any;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  timestamp: string;
  api_connectivity: boolean;
  last_successful_request?: string;
  error?: string;
}

export interface ServiceStats {
  requestCount: number;
  errorCount: number;
  totalResponseTime: number;
  startTime: number;
  lastRequest?: string;
  averageResponseTime: number;
}

// Common bank codes for Nigeria
const NIGERIAN_BANK_CODES: Record<string, BankCode> = {
  '000013': { code: '000013', name: 'GTBank', country: 'NG' },
  '000014': { code: '000014', name: 'Access Bank', country: 'NG' },
  '000015': { code: '000015', name: 'First Bank', country: 'NG' },
  '000016': { code: '000016', name: 'UBA', country: 'NG' },
  '000017': { code: '000017', name: 'Zenith Bank', country: 'NG' },
  '000018': { code: '000018', name: 'FCMB', country: 'NG' },
  '000019': { code: '000019', name: 'Union Bank', country: 'NG' },
  '000020': { code: '000020', name: 'Sterling Bank', country: 'NG' },
  '000021': { code: '000021', name: 'Fidelity Bank', country: 'NG' },
  '000022': { code: '000022', name: 'Wema Bank', country: 'NG' },
  '000023': { code: '000023', name: 'Providus Bank', country: 'NG' },
  '000024': { code: '000024', name: 'Kuda Bank', country: 'NG' },
  '000025': { code: '000025', name: 'Opay', country: 'NG' },
  '000026': { code: '000026', name: 'PalmPay', country: 'NG' },
  '000027': { code: '000027', name: 'VFD Microfinance Bank', country: 'NG' },
  '000028': { code: '000028', name: 'Moniepoint', country: 'NG' },
  '000029': { code: '000029', name: 'Carbon', country: 'NG' },
  '000030': { code: '000030', name: 'Fairmoney', country: 'NG' }
};

// Export the bank codes as a regular export, not in default
export { NIGERIAN_BANK_CODES };