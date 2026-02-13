# EDOC Product Guide Review (Phase 5 Input)

Source reviewed:
- `/Users/seyederick/onasis-gateway/services/edoc-external-app-integration---for-clients-postman-collection/API PRODUCT GUIDE- Full.pdf`

## What This PDF Confirms

1. Product scope:
- EDOC provides automated bank statement retrieval and analytics outputs.

2. Authentication model (high-level):
- API uses `Authorization: Bearer <token>`.
- A `client id` is also required.

3. Integration area called out:
- "Dashboard" API is referenced for categorized transaction analytics.

4. Canonical API docs link:
- `https://documenter.getpostman.com/view/21424784/2s9YJdUgXJ`

## What Is Missing (Blocking Full Adapter Build)

The PDF does **not** provide full executable API contract details needed for adapter generation:

1. No complete endpoint list (paths + methods).
2. No request/response schemas per endpoint.
3. No error code contract.
4. No webhook signatures/events contract.
5. No environment base URL table (dev/stage/prod).

## Current Local Folder State

Folder:
- `/Users/seyederick/onasis-gateway/services/edoc-external-app-integration---for-clients-postman-collection`

Contains:
- `API PRODUCT GUIDE- Full.pdf`
- `client.js` (stub)
- `test.js` (stub)
- `webhooks.js` (stub)

Missing:
- Postman collection JSON (or OpenAPI spec) for endpoint-level mapping.

## Phase 5 Recommendation

1. Export and add EDOC Postman collection JSON into the service folder.
2. Generate endpoint map from collection:
- tool id
- HTTP method
- route
- auth requirement
- payload schema
- response schema
3. Add EDOC adapter with explicit contract mapping:
- contract version
- request builder
- response normalizer
- error mapper
4. Add integration tests for at least:
- auth flow
- dashboard analytics fetch
- one webhook or callback path (if applicable).

