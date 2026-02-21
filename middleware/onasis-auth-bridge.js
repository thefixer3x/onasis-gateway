/**
 * Onasis-CORE Authentication Bridge Middleware
 * Bridges onasis-gateway with onasis-core authentication system
 */

const fetch = globalThis.fetch
  ? globalThis.fetch.bind(globalThis)
  : (...args) => import('node-fetch').then((mod) => (mod.default || mod)(...args));

class OnasisAuthBridge {
  constructor(config = {}) {
    const rawAuthApiUrl = config.authApiUrl
      || process.env.ONASIS_AUTH_API_URL
      || process.env.AUTH_GATEWAY_URL
      || 'http://127.0.0.1:4000';

    this.config = {
      ...config,
      authApiUrl: this.normalizeAuthApiUrl(rawAuthApiUrl),
      sessionPath: config.sessionPath || process.env.ONASIS_AUTH_SESSION_PATH || '/session',
      apiKeyPath: config.apiKeyPath || process.env.ONASIS_AUTH_APIKEY_PATH || '/verify-api-key',
      projectScope: config.projectScope || 'lanonasis-maas',
      timeout: config.timeout || 10000,
      retries: config.retries || 2
    };

    // Cache for session validation
    this.sessionCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  normalizeAuthApiUrl(value) {
    const raw = (value || '').trim();
    if (!raw) {
      return 'http://127.0.0.1:4000/v1/auth';
    }

    const trimmed = raw.replace(/\/+$/, '');
    if (/\/v1\/auth$/i.test(trimmed)) return trimmed;
    if (/\/v1$/i.test(trimmed)) return `${trimmed}/auth`;
    return `${trimmed}/v1/auth`;
  }

  normalizeProxyPath(value) {
    let path = (value || '').toString();
    if (!path.startsWith('/')) path = `/${path}`;

    // Accept incoming forms like /api/auth/..., /v1/auth/... or just /...
    path = path.replace(/^\/api\/auth/i, '');
    path = path.replace(/^\/v1\/auth/i, '');

    return path || '/';
  }

  /**
   * Main authentication middleware
   */
  authenticate(options = {}) {
    const {
      required = true,
      allowAnonymous = false,
      checkPermissions = null
    } = options;

    return async (req, res, next) => {
      try {
        const authResult = await this.validateRequest(req);
        
        if (!authResult.authenticated && required && !allowAnonymous) {
          return res.status(401).json({
            error: 'Authentication required',
            code: 'AUTH_REQUIRED',
            message: 'Valid authentication token must be provided'
          });
        }

        // Attach auth context to request
        req.auth = authResult;
        req.user = authResult.user;

        // Check permissions if required
        if (checkPermissions && authResult.authenticated) {
          const hasPermission = await this.checkUserPermissions(authResult.user, checkPermissions);
          if (!hasPermission) {
            return res.status(403).json({
              error: 'Insufficient permissions',
              code: 'INSUFFICIENT_PERMISSIONS'
            });
          }
        }

        next();
      } catch (error) {
        console.error('Authentication middleware error:', error.message);
        
        if (required) {
          return res.status(500).json({
            error: 'Authentication service error',
            code: 'AUTH_SERVICE_ERROR'
          });
        }

        // Continue with anonymous access if auth not required
        req.auth = { authenticated: false, user: null };
        req.user = null;
        next();
      }
    };
  }

  /**
   * Validate incoming request authentication
   */
  async validateRequest(req) {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    const userId = req.headers['x-user-id'];

    // 1. Try Bearer token first (remote validation)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return await this.validateJWTToken(token);
    }

    // 2. Try API key authentication (remote validation)
    if (apiKey) {
      return await this.validateAPIKey(apiKey);
    }

    // 3. Try session validation for SSE/WebSocket
    if (userId && (req.path.includes('/sse') || req.path.includes('/ws'))) {
      return await this.validateSession(userId);
    }

    // 4. No authentication provided
    return {
      authenticated: false,
      user: null,
      method: 'none'
    };
  }

  /**
   * Validate Bearer token against onasis-core auth.
   * Handles three token types:
   *   1. Auth-gateway JWTs  → GET /session (requireAuth validates JWT + session lookup)
   *   2. Opaque OAuth PKCE tokens → GET /session returns 401; fallback to POST /verify-token
   *      (public endpoint that uses introspectToken against oauth_tokens table)
   *   3. Anything else → authenticated: false
   */
  async validateJWTToken(token) {
    try {
      // Primary path: session validation (works for gateway-issued JWTs)
      const response = await this.makeAuthRequest(this.config.sessionPath, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Project-Scope': this.config.projectScope
        }
      });

      if (response.ok) {
        const sessionData = await response.json();
        return {
          authenticated: true,
          user: sessionData.user,
          method: 'jwt_remote',
          token: token,
          expires_in: sessionData.expires_in
        };
      }

      // Fallback for opaque OAuth tokens: session endpoint returns 401 because
      // requireAuth only accepts JWTs and API keys, not opaque PKCE tokens.
      // POST /verify-token is public and handles all three token types via introspection.
      if (response.status === 401 || response.status === 403) {
        try {
          const verifyResponse = await this.makeAuthRequest('/verify-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Project-Scope': this.config.projectScope
            },
            body: JSON.stringify({ token })
          });

          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            if (verifyData.valid) {
              return {
                authenticated: true,
                user: verifyData.user || null,
                method: 'oauth_token',
                token: token,
                expires_at: verifyData.expires_at
              };
            }
          }
        } catch (verifyError) {
          console.warn('OAuth token fallback verification failed:', verifyError.message);
        }
      }

      return {
        authenticated: false,
        user: null,
        method: 'jwt_invalid',
        error: 'Token validation failed'
      };

    } catch (error) {
      console.error('JWT validation error:', error);
      return {
        authenticated: false,
        user: null,
        method: 'jwt_error',
        error: error.message
      };
    }
  }

  /**
   * Validate API key (for service-to-service calls)
   */
  async validateAPIKey(apiKey) {
    try {
      const response = await this.makeAuthRequest(this.config.apiKeyPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Project-Scope': this.config.projectScope,
          // auth.lanonasis.com verify-api-key expects key in header, not only body
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ api_key: apiKey })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          authenticated: true,
          user: data.user || null,
          method: 'api_key',
          key_prefix: apiKey.substring(0, 8) + '...'
        };
      }

      return {
        authenticated: false,
        user: null,
        method: 'api_key_invalid',
        error: `API key validation failed: ${response.status}`
      };

    } catch (error) {
      console.error('API key validation error:', error);
      return {
        authenticated: false,
        user: null,
        method: 'api_key_error',
        error: error.message
      };
    }
  }

  /**
   * Validate session for SSE/WebSocket connections
   */
  async validateSession(userId) {
    try {
      const cacheKey = `session_${userId}`;
      const cached = this.sessionCache.get(cacheKey);

      // Return cached result if valid
      if (cached && Date.now() < cached.expires) {
        return cached.data;
      }

      // Validate session - for now, basic user ID validation
      // In production, this would check active sessions in database
      const sessionValid = userId && userId.length > 3;

      const result = {
        authenticated: sessionValid,
        user: sessionValid ? {
          id: userId,
          type: 'session'
        } : null,
        method: 'session'
      };

      // Cache result
      this.sessionCache.set(cacheKey, {
        data: result,
        expires: Date.now() + this.cacheTimeout
      });

      return result;

    } catch (error) {
      console.error('Session validation error:', error);
      return {
        authenticated: false,
        user: null,
        method: 'session_error',
        error: error.message
      };
    }
  }

  /**
   * Check user permissions for specific operations
   */
  async checkUserPermissions(user, requiredPermissions) {
    if (!user || !requiredPermissions) return true;

    // Basic role-based permission checking
    const userRole = user.role || 'user';
    
    if (Array.isArray(requiredPermissions)) {
      return requiredPermissions.some(permission => this.hasPermission(userRole, permission));
    }
    
    return this.hasPermission(userRole, requiredPermissions);
  }

  /**
   * Simple role-based permission system
   */
  hasPermission(userRole, permission) {
    const roleHierarchy = {
      'admin': ['admin', 'user', 'read'],
      'user': ['user', 'read'],
      'read': ['read']
    };

    return roleHierarchy[userRole]?.includes(permission) || false;
  }

  /**
   * Proxy authentication requests to onasis-core
   */
  async proxyAuthRequest(req, res) {
    try {
      const basePath = this.normalizeProxyPath(req.path || req.originalUrl || '/');
      const query = req.query && typeof req.query === 'object'
        ? new URLSearchParams(
            Object.entries(req.query).flatMap(([key, value]) => {
              if (value === undefined || value === null) return [];
              if (Array.isArray(value)) return value.map((item) => [key, `${item}`]);
              return [[key, `${value}`]];
            })
          ).toString()
        : '';
      const path = query ? `${basePath}?${query}` : basePath;
      const method = req.method;
      const body = req.body;
      const headers = {
        'Content-Type': 'application/json',
        'X-Project-Scope': this.config.projectScope,
        ...req.headers
      };

      // Remove host headers to avoid conflicts
      delete headers.host;
      delete headers['content-length'];

      const response = await this.makeAuthRequest(path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        return res.status(502).json({
          error: 'Invalid response from authentication service',
          code: 'AUTH_PROXY_PARSE_ERROR'
        });
      }

      if (!res.headersSent) {
        return res.status(response.status).json(responseData);
      }

    } catch (error) {
      console.error('Auth proxy error:', error);
      res.status(500).json({
        error: 'Authentication service unavailable',
        code: 'AUTH_PROXY_ERROR'
      });
    }
  }

  /**
   * Make HTTP request to onasis-core auth API
   */
  async makeAuthRequest(path, options = {}) {
    const normalizedPath = this.normalizeProxyPath(path);
    const url = `${this.config.authApiUrl}${normalizedPath}`;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout);
      try {
        return await fetch(url, {
          ...options,
          signal: controller.signal
        });
      } catch (error) {
        if (attempt === this.config.retries) {
          throw error;
        }
        console.warn(`Auth API request failed (attempt ${attempt}/${this.config.retries}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  /**
   * Middleware to extract user context for service adapters
   */
  injectUserContext() {
    return (req, res, next) => {
      if (req.auth && req.auth.authenticated) {
        // Add user context for adapter authentication
        req.adapterContext = {
          userId: req.user.id,
          projectScope: req.user.project_scope || this.config.projectScope,
          userRole: req.user.role,
          authMethod: req.auth.method
        };
      }
      next();
    };
  }

  /**
   * Health check for auth service
   */
  async healthCheck() {
    try {
      const response = await this.makeAuthRequest('/health');
      if (response.ok) {
        const health = await response.json();
        return {
          status: 'healthy',
          auth_service: health,
          bridge_version: '1.0.0'
        };
      }
      return {
        status: 'unhealthy',
        error: `Auth service returned ${response.status}`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Clear session cache (for testing/debugging)
   */
  clearCache() {
    this.sessionCache.clear();
  }
}

module.exports = OnasisAuthBridge;
