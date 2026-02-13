# Auth Gateway Service

This service provides centralized authentication and authorization for the Onasis Gateway ecosystem.

## Features
- User authentication (login, registration)
- Token validation and refresh
- API key management
- Session management
- User profile management

## Integration
This service connects to the centralized auth gateway at `auth.lanonasis.com` and provides MCP-compatible tools for authentication operations.

## MCP Tools
- `authenticate-user` - Authenticate a user with username/password or social login
- `validate-token` - Validate a JWT token and return user information
- `refresh-token` - Refresh an expired JWT token
- `generate-api-key` - Generate a new API key for a user or service
- `revoke-api-key` - Revoke an existing API key
- `list-api-keys` - List all API keys for a user
- `get-session` - Get session information for a user
- `logout` - Logout a user and invalidate their session
- `create-user` - Create a new user account
- `update-user` - Update user profile information