#!/usr/bin/env bash

set -u

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
MCP_URL="${MCP_URL:-$BASE_URL/mcp}"
CURL_MAX_TIME="${CURL_MAX_TIME:-40}"

CLIENT_ID="${EDOC_CLIENT_ID:-ZGVtb19jbGllbnQ=}"
AUTH_TOKEN="${EDOC_BEARER_TOKEN:-}"
TEST_EMAIL="${EDOC_TEST_EMAIL:-pathik_demo@edoc.ng}"
TEST_CONSENT_ID="${EDOC_TEST_CONSENT_ID:-b4fa2d6e-44ff-4732-b67a-dd4774ad345f}"

PASS=0
FAIL=0

header_args=("-H" "Content-Type: application/json")
if [ -n "$CLIENT_ID" ]; then
  header_args+=("-H" "client-id: $CLIENT_ID")
fi
if [ -n "$AUTH_TOKEN" ]; then
  header_args+=("-H" "Authorization: Bearer $AUTH_TOKEN")
fi

extract_inner_json() {
  python3 - "$1" <<'PY'
import json,sys
raw=sys.argv[1]
try:
    obj=json.loads(raw)
    txt=obj["result"]["content"][0]["text"]
    inner=json.loads(txt)
    print(json.dumps(inner))
except Exception as e:
    print(json.dumps({"success":False,"error":{"message":f"parse_error: {e}"}}))
PY
}

run_case() {
  local title="$1"
  local payload="$2"
  local mode="${3:-report}" # report|expect-success|expect-failure

  echo
  echo "=== $title ==="

  local raw
  raw="$(curl -sS --max-time "$CURL_MAX_TIME" -X POST "$MCP_URL" "${header_args[@]}" -d "$payload" 2>&1)"
  local inner
  inner="$(extract_inner_json "$raw")"

  echo "$inner" | python3 -m json.tool

  local success
  success="$(python3 - "$inner" <<'PY'
import json,sys
obj=json.loads(sys.argv[1])
print("true" if obj.get("success") is True else "false")
PY
)"

  if [ "$mode" = "expect-success" ]; then
    if [ "$success" = "true" ]; then
      PASS=$((PASS+1))
    else
      FAIL=$((FAIL+1))
    fi
    return
  fi

  if [ "$mode" = "expect-failure" ]; then
    if [ "$success" = "false" ]; then
      PASS=$((PASS+1))
    else
      FAIL=$((FAIL+1))
    fi
    return
  fi

  if [ "$success" = "true" ]; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
  fi
}

echo "EDOC E2E Test"
echo "BASE_URL=$BASE_URL"
echo "MCP_URL=$MCP_URL"
echo "CLIENT_ID_SET=$([ -n "$CLIENT_ID" ] && echo yes || echo no)"
echo "AUTH_TOKEN_SET=$([ -n "$AUTH_TOKEN" ] && echo yes || echo no)"
echo "TEST_EMAIL=$TEST_EMAIL"
echo "TEST_CONSENT_ID=$TEST_CONSENT_ID"

echo
echo "=== Health ==="
if curl -sS --max-time "$CURL_MAX_TIME" "$BASE_URL/health" | python3 -m json.tool; then
  PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

run_case "gateway-tools (edoc adapter)" \
  "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-tools\",\"arguments\":{\"adapter\":\"edoc-external-app-integration-for-clients\",\"limit\":50}}}" \
  "expect-success"

# Dry-run checks (execution contract validation without external side effects).
run_case "dry-run initialize-consent" \
  "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-execute\",\"arguments\":{\"tool_id\":\"edoc-external-app-integration-for-clients:initialize-consent\",\"params\":{\"email\":\"$TEST_EMAIL\",\"redirection_url\":\"https://app.lanonasis.com/callback\"},\"options\":{\"dry_run\":true}}}}"

run_case "dry-run fetch-user-consents" \
  "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-execute\",\"arguments\":{\"tool_id\":\"edoc-external-app-integration-for-clients:fetch-user-consents\",\"params\":{\"email\":\"$TEST_EMAIL\"},\"options\":{\"dry_run\":true}}}}"

run_case "dry-run fetch-consent" \
  "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-execute\",\"arguments\":{\"tool_id\":\"edoc-external-app-integration-for-clients:fetch-consent\",\"params\":{\"consent_id\":\"$TEST_CONSENT_ID\"},\"options\":{\"dry_run\":true}}}}"

run_case "dry-run get-dashboard" \
  "{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-execute\",\"arguments\":{\"tool_id\":\"edoc-external-app-integration-for-clients:get-dashboard\",\"params\":{\"consent_id\":\"$TEST_CONSENT_ID\"},\"options\":{\"dry_run\":true}}}}"

run_case "dry-run delete-consent (high risk)" \
  "{\"jsonrpc\":\"2.0\",\"id\":6,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-execute\",\"arguments\":{\"tool_id\":\"edoc-external-app-integration-for-clients:delete-consent\",\"params\":{\"consent_id\":\"$TEST_CONSENT_ID\"},\"options\":{\"dry_run\":true,\"idempotency_key\":\"dry-delete-001\",\"confirmed\":true}}}}"

run_case "dry-run webhook-sample-request (high risk)" \
  "{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-execute\",\"arguments\":{\"tool_id\":\"edoc-external-app-integration-for-clients:webhook-sample-request\",\"params\":{\"event\":\"consent.transactions\",\"data\":{\"consentId\":\"$TEST_CONSENT_ID\",\"consentStatus\":\"Active\",\"balance\":57157.7,\"transactions\":[]}},\"options\":{\"dry_run\":true,\"idempotency_key\":\"dry-webhook-001\"}}}}"

# Live execution checks.
run_case "live initialize-consent" \
  "{\"jsonrpc\":\"2.0\",\"id\":8,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-execute\",\"arguments\":{\"tool_id\":\"edoc-external-app-integration-for-clients:initialize-consent\",\"params\":{\"email\":\"$TEST_EMAIL\",\"redirection_url\":\"https://app.lanonasis.com/callback\"}}}}"

run_case "live fetch-user-consents" \
  "{\"jsonrpc\":\"2.0\",\"id\":9,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-execute\",\"arguments\":{\"tool_id\":\"edoc-external-app-integration-for-clients:fetch-user-consents\",\"params\":{\"email\":\"$TEST_EMAIL\"}}}}"

run_case "live fetch-consent" \
  "{\"jsonrpc\":\"2.0\",\"id\":10,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-execute\",\"arguments\":{\"tool_id\":\"edoc-external-app-integration-for-clients:fetch-consent\",\"params\":{\"consent_id\":\"$TEST_CONSENT_ID\"}}}}"

run_case "live get-dashboard" \
  "{\"jsonrpc\":\"2.0\",\"id\":11,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-execute\",\"arguments\":{\"tool_id\":\"edoc-external-app-integration-for-clients:get-dashboard\",\"params\":{\"consent_id\":\"$TEST_CONSENT_ID\"}}}}"

run_case "live delete-consent" \
  "{\"jsonrpc\":\"2.0\",\"id\":12,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-execute\",\"arguments\":{\"tool_id\":\"edoc-external-app-integration-for-clients:delete-consent\",\"params\":{\"consent_id\":\"$TEST_CONSENT_ID\"},\"options\":{\"idempotency_key\":\"live-delete-001\",\"confirmed\":true}}}}"

run_case "live webhook-sample-request" \
  "{\"jsonrpc\":\"2.0\",\"id\":13,\"method\":\"tools/call\",\"params\":{\"name\":\"gateway-execute\",\"arguments\":{\"tool_id\":\"edoc-external-app-integration-for-clients:webhook-sample-request\",\"params\":{\"event\":\"consent.transactions\",\"data\":{\"consentId\":\"$TEST_CONSENT_ID\",\"consentStatus\":\"Active\",\"balance\":57157.7,\"transactions\":[]}},\"options\":{\"idempotency_key\":\"live-webhook-001\"}}}}"

echo
echo "========================================"
echo "EDOC E2E Results"
echo "========================================"
echo "PASS=$PASS"
echo "FAIL=$FAIL"
echo "TOTAL=$((PASS+FAIL))"
echo
echo "Notes:"
echo "- Dry-run validates gateway schema + policy paths."
echo "- Live checks validate full adapter + upstream EDOC/Supabase behavior."
echo "- Use EDOC_BEARER_TOKEN when upstream requires user/service JWT."

