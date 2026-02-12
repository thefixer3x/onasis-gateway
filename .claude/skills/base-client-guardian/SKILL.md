---
name: base-client-guardian
description: "Guardrails for edits to core/base-client.js covering auth injection, retries, circuit breaker behavior, and request/response events. Use when modifying the universal API client or its auth/retry/error handling."
---

# Skill: Base Client Guardian

## Purpose & Scope

This skill applies when modifying the **Universal API Client** (`core/base-client.js`).

The Base Client provides:
- HTTP request handling with axios
- Multi-protocol authentication (Bearer, API Key, Basic, HMAC, OAuth2)
- Exponential backoff retry logic
- Circuit breaker pattern for fault tolerance
- Rate limiting management
- EventEmitter-based request/response/error logging

## Critical Rules - NEVER Do

### Public Method Stability
- **NEVER** remove or rename these public methods:
  - `request()` - Main entry point for API calls
  - `retryRequest()` - Handles retry logic with backoff
  - `healthCheck()` - Service health verification
  - `generateMethods()` - Dynamic method generation from endpoints
  - `addAuthentication()` - Auth injection into requests

### EventEmitter Events
- **NEVER** remove or rename these event names:
  - `request` - Emitted before each request
  - `response` - Emitted on successful response
  - `error` - Emitted on request failure
  - `circuit-breaker-open` - Emitted when circuit opens

### Authentication Types
- **NEVER** change these auth type identifiers:
  - `bearer` - Bearer token auth
  - `apikey` - API key (header or query)
  - `basic` - Basic auth
  - `hmac` - HMAC signature auth
  - `oauth2` - OAuth 2.0 auth

### Security
- **NEVER** log sensitive data (auth tokens, credentials, API keys)
- **NEVER** disable TLS/SSL verification
- **NEVER** expose raw credentials in error messages
- **NEVER** store credentials in plain text

### Circuit Breaker
- **NEVER** change the state machine flow: `CLOSED -> OPEN -> HALF_OPEN -> CLOSED`
- **NEVER** remove the 5-failure threshold for circuit opening
- **NEVER** remove the 60-second recovery timeout

## Required Patterns - MUST Follow

### Retry Logic
```javascript
// MUST use exponential backoff
const delay = this.config.retryDelay * Math.pow(2, attempt - 1);

// MUST check shouldRetry() before retrying
if (attempt < this.config.retryAttempts && this.shouldRetry(error)) {
    await this.sleep(delay);
    return this.retryRequest(config, attempt + 1);
}
```

### Event Emission
```javascript
// MUST emit events after state changes
this.emit('request', { service, method, url, timestamp });
this.emit('response', { service, status, statusText, timestamp });
this.emit('error', { service, type, message, status, timestamp });
```

### Circuit Breaker State Management
```javascript
// MUST follow state machine
// On success: reset to CLOSED
this.circuitBreaker.failures = 0;
this.circuitBreaker.state = 'CLOSED';

// On failure: increment and potentially open
this.circuitBreaker.failures++;
if (this.circuitBreaker.failures >= 5) {
    this.circuitBreaker.state = 'OPEN';
    this.emit('circuit-breaker-open', { service, failures });
}

// On timeout: transition to HALF_OPEN
if (timeSinceLastFailure > 60000) {
    this.circuitBreaker.state = 'HALF_OPEN';
}
```

### Authentication Handling
```javascript
// MUST handle all auth types in switch statement
switch (auth.type) {
    case 'bearer':
    case 'apikey':
    case 'basic':
    case 'hmac':
    case 'oauth2':
        // Implementation here
        break;
}
```

## Safe Modification Examples

### Adding a New Authentication Type
```javascript
// Add to the switch statement in addAuthentication()
case 'custom_auth_type':
    config.headers['X-Custom-Auth'] = auth.config.customValue;
    break;
```

### Adding New Retry Conditions
```javascript
// Extend shouldRetry() - do NOT replace existing conditions
shouldRetry(error) {
    return (
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'YOUR_NEW_CODE' ||  // ADD here
        (error.response && error.response.status >= 500)
    );
}
```

### Adding New Events
```javascript
// Add new events - do NOT modify existing event signatures
this.emit('your-new-event', { service, customData, timestamp });
```

## Integration Points

| Component | Integration Method |
|-----------|-------------------|
| Metrics Collector | Listen to `request`, `response`, `error` events |
| Compliance Manager | Intercept in `addAuthentication()` |
| Version Manager | Pass version in request options |
| Vendor Abstraction | Uses `request()` method |

## Testing Requirements

Before any changes to this file:

```bash
# 1. Run existing tests
npm test -- --grep "BaseClient"

# 2. Verify authentication works for all types
node -e "
const BaseClient = require('./core/base-client');
const client = new BaseClient({ name: 'test', baseUrl: 'https://httpbin.org' });
console.log('Client initialized:', client.config.name);
"

# 3. Test circuit breaker states
# Verify: CLOSED -> OPEN (after 5 failures) -> HALF_OPEN (after 60s)

# 4. Test retry logic
# Verify exponential backoff: delay * 2^(attempt-1)
```

## Rollback Procedure

If changes cause issues:

1. **Immediate Rollback**
   ```bash
   git checkout HEAD~1 -- core/base-client.js
   ```

2. **Verify Recovery**
   ```bash
   # Restart the server
   bun run dev

   # Check health endpoint
   curl http://localhost:3001/health
   ```

3. **Event Listener Check**
   ```javascript
   // Verify all components can still receive events
   client.on('request', () => console.log('Request event works'));
   client.on('response', () => console.log('Response event works'));
   client.on('error', () => console.log('Error event works'));
   ```
