# Security Service

This service provides API key management and security services.

## Features
- API key creation, rotation, and revocation
- Token validation
- Permission checking
- Access control
- Security event logging
- Audit trail management

## Integration
This service connects to Supabase Edge Functions and provides MCP-compatible tools for security operations.

## MCP Tools
- `create-api-key` - Create a new API key
- `delete-api-key` - Delete an existing API key
- `rotate-api-key` - Rotate an existing API key (generate new key, invalidate old)
- `revoke-api-key` - Revoke an existing API key
- `list-api-keys` - List all API keys for a user
- `verify-token` - Verify an authentication token
- `check-permissions` - Check if a user has specific permissions
- `log-security-event` - Log a security-related event