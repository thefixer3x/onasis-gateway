/**
 * Onasis-CORE Authentication Bridge Middleware
 * Bridges onasis-gateway with onasis-core authentication system
 */

const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

class OnasisAuthBridge {
  constructor(config = {}) {
    this.config = {
      authApiUrl: config.authApiUrl || process.env.ONASIS_AUTH_API_URL || 'https://api.lanonasis.com/v1/auth',
      jwtSecret: config.jwtSecret || process.env.ONASIS_JWT_SECRET || process.env.JWT_SECRET,
      projectScope: config.projectScope || 'lanonasis-maas',
      timeout: config.timeout || 10000,
      retries: config.retries || 2,
      ...config
    };
    
    // Cache for session validation
    this.sessionCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
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
        console.error('Authentication middleware error:', error);
        
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

    // 1. Try JWT Bearer token first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return await this.validateJWTToken(token);
    }

    // 2. Try API key authentication
    if (apiKey) {
      return await this.validateAPIKey(apiKey);
    }

    // 3. Try session validation for SSE/WebSocket
    if (userId && req.path.includes('/sse') || req.path.includes('/ws')) {
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
   * Validate JWT token against onasis-core auth
   */
  async validateJWTToken(token) {
    try {
      // First try local JWT verification for performance
      if (this.config.jwtSecret) {
        try {
          const decoded = jwt.verify(token, this.config.jwtSecret);
          
          // Check if token is from correct project scope
          if (decoded.project_scope === this.config.projectScope) {
            return {
              authenticated: true,
              user: {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role,
                project_scope: decoded.project_scope
              },
              method: 'jwt_local',
              token: token
            };
          }
        } catch (jwtError) {
          // Fall through to remote validation
          console.log('Local JWT validation failed, trying remote validation');
        }
      }

      // Remote session validation via onasis-core auth API
      const response = await this.makeAuthRequest('/session', {
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
      // For now, implement basic API key validation
      // This should integrate with the vendor_api_keys table in onasis-core
      
      // Mock validation - in production this would query the database
      if (apiKey.startsWith('lmk_') && apiKey.length > 20) {
        return {
          authenticated: true,
          user: {
            id: 'api_user',
            type: 'api_key',
            key_prefix: apiKey.substring(0, 8) + '...'
          },
          method: 'api_key'
        };
      }

      return {
        authenticated: false,
        user: null,
        method: 'api_key_invalid',
        error: 'Invalid API key format'
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
      const path = req.path.replace('/api/auth', '');
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

      const responseData = await response.json();
      
      res.status(response.status).json(responseData);

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
    const url = `${this.config.authApiUrl}${path}`;
    
    const requestOptions = {
      timeout: this.config.timeout,
      ...options
    };

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        return await fetch(url, requestOptions);
      } catch (error) {
        if (attempt === this.config.retries) {
          throw error;
        }
        console.warn(`Auth API request failed (attempt ${attempt}/${this.config.retries}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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