# EDOC App Onboarding Runbook

Date: 2026-02-13

## Purpose

This runbook shows how to onboard application clients to EDOC through Onasis Gateway, using the live EDOC adapter:

- Adapter ID: `edoc-external-app-integration-for-clients`
- Transport: MCP `gateway-execute` via `POST /mcp`
- Contract source: Postman collection (`FOR CLIENTS`, 6 operations)

## What Was Validated End-to-End

### Gateway + Adapter Runtime

Validated:
- Gateway booted successfully on `http://127.0.0.1:3000`
- EDOC adapter loaded as **real/live** (not mock)
- Discovery and execution meta-tools worked:
  - `gateway-adapters`
  - `gateway-tools`
  - `gateway-execute`

### EDOC Tool Contract in Gateway

Validated tool inventory (6 tools):
- `fetch-user-consents`
- `initialize-consent`
- `fetch-consent`
- `delete-consent`
- `get-dashboard`
- `webhook-sample-request`

### Live Upstream Behavior Snapshot

Observed during live execution and direct Supabase probes:
- `edoc-consent` returned `401 Unauthorized` with anon auth.
- `edoc` returned `400 Missing action parameter` for tested payload.
- `init-consent`, `consent-status`, `edoc-dashboard`, `delete-consent` showed timeout behavior in this environment.

Conclusion:
- Gateway execution pipeline is healthy.
- Remaining failures are upstream auth/contract/runtime issues in EDOC function wrappers.

### Latest Script Run Snapshot

Command used:
- `BASE_URL=http://127.0.0.1:3000 EDOC_CLIENT_ID=ZGVtb19jbGllbnQ= /Users/seyederick/onasis-gateway/scripts/test-edoc-e2e.sh`

Result:
- `PASS=7`
- `FAIL=7`
- `TOTAL=14`

Interpretation:
- Discovery and all dry-run validations passed.
- Live failures were upstream (`401`, timeout, then circuit breaker open), not discovery/registry wiring.

## Prerequisites for App Onboarding

1. Gateway runtime:
- Gateway running (`npm start`) and healthy (`GET /health`).

2. EDOC credentials:
- Valid `client-id` (required by EDOC contract).
- Valid bearer token (set as `EDOC_BEARER_TOKEN`) where required by upstream EDOC wrappers.

3. Supabase function readiness:
- `init-consent`
- `consent-status`
- `edoc-dashboard`
- `delete-consent`
- `edoc-consent` / `edoc`

4. Stable request contract:
- Confirm action and payload schema expected by each wrapper function.

## Standard E2E Test Command

Use the reusable script:

```bash
BASE_URL=http://127.0.0.1:3000 \
EDOC_CLIENT_ID='YOUR_CLIENT_ID' \
EDOC_BEARER_TOKEN='YOUR_BEARER_TOKEN' \
EDOC_TEST_EMAIL='user@example.com' \
EDOC_TEST_CONSENT_ID='your-consent-id' \
/Users/seyederick/onasis-gateway/scripts/test-edoc-e2e.sh
```

What it covers:
- Gateway health
- Adapter/tool discovery
- Dry-run validation for all 6 tools
- Live execution for all 6 tools
- Pass/fail summary

## App Onboarding Sequence

1. Initialize consent:
- Tool: `edoc-external-app-integration-for-clients:initialize-consent`
- Inputs: `email`, `redirection_url`

2. Redirect user to consent flow:
- Use consent/session link returned by step 1.

3. Poll consent state:
- Tool: `edoc-external-app-integration-for-clients:fetch-consent`
- Input: `consent_id`

4. Fetch dashboard:
- Tool: `edoc-external-app-integration-for-clients:get-dashboard`
- Input: `consent_id`

5. Optional consent cleanup:
- Tool: `edoc-external-app-integration-for-clients:delete-consent`
- Inputs: `consent_id`, execution `options.idempotency_key`, `options.confirmed=true`

6. Webhook ingestion test:
- Tool: `edoc-external-app-integration-for-clients:webhook-sample-request`
- Inputs: `event`, `data`, execution `options.idempotency_key`

## Troubleshooting Matrix

1. `IDEMPOTENCY_REQUIRED`:
- Add `options.idempotency_key` for high-risk tools.

2. `CONFIRMATION_REQUIRED`:
- Add `options.confirmed=true` for destructive operations (delete/cancel/remove/revoke).

3. `401 Unauthorized`:
- Verify `client-id` and bearer token.
- Confirm upstream EDOC function accepts anon vs user/service JWT.

4. `Missing action parameter`:
- Align payload with wrapper function action contract.
- Confirm wrapper expects body action vs query action.

5. Timeout (`30000ms exceeded`):
- Verify upstream EDOC target service reachability.
- Check EDOC secrets/config in Supabase functions.
- Check function logs and cold-start behavior.
