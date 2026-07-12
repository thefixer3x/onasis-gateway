#!/usr/bin/env bash
# gateway-health.sh — VPS readiness check for the onasis-gateway consolidation.
#
# Phase 0 / Phase 1 deliverable (SDK-17). Run on the VPS (`lanonasis-main`,
# 138.199.231.0) AFTER gateway.conf has been deployed but BEFORE shadow-mode
# cutover. All checks must return 0 before Phase 1 traffic comparison is
# permitted.
#
# Usage:
#   ./scripts/gateway-health.sh                 # default ports per ROUTE_MAP.yaml
#   ./scripts/gateway-health.sh --strict        # exit 1 on any non-200
#
# Exit codes:
#   0  All checks green
#   1  At least one health check failed
#   2  Required tooling (curl, jq) missing

set -euo pipefail

CENTRAL_PORT="${CENTRAL_PORT:-3000}"
AUTH_PORT="${AUTH_PORT:-4000}"
ENTERPRISE_MCP_PORT="${ENTERPRISE_MCP_PORT:-3001}"
MCP_HTTP_PORT="${MCP_HTTP_PORT:-3001}"
GATEWAY_HOST="${GATEWAY_HOST:-127.0.0.1}"
NGINX_HOST_HEADER="${NGINX_HOST_HEADER:-gateway.lanonasis.com}"
STRICT="${STRICT:-0}"

for bin in curl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: required binary '$bin' not found" >&2
    exit 2
  fi
done

declare -a CHECKS=(
  "central-gateway|http://${GATEWAY_HOST}:${CENTRAL_PORT}/health"
  "auth-gateway|http://${GATEWAY_HOST}:${AUTH_PORT}/health"
  "enterprise-mcp|http://${GATEWAY_HOST}:${ENTERPRISE_MCP_PORT}/health"
  "mcp-core-http|http://${GATEWAY_HOST}:${MCP_HTTP_PORT}/health"
)

failures=0

echo "=== onasis-gateway health check ==="
echo "gateway host: ${GATEWAY_HOST}"
echo "central :${CENTRAL_PORT}  auth :${AUTH_PORT}  enterprise-mcp :${ENTERPRISE_MCP_PORT}  mcp-http :${MCP_HTTP_PORT}"
echo

for entry in "${CHECKS[@]}"; do
  name="${entry%%|*}"
  url="${entry##*|}"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "000")
  if [[ "$code" == "200" ]]; then
    printf "  [ OK ] %-20s %s -> %s\n" "$name" "$url" "$code"
  else
    printf "  [FAIL] %-20s %s -> %s\n" "$name" "$url" "$code"
    failures=$((failures + 1))
  fi
done

echo
echo "=== Nginx routing sanity ==="
# curl follows the expected 301→HTTPS upgrade so we can validate the
# user-facing endpoint, not just the plain-HTTP listener.
nginx_code=$(curl -sL -o /dev/null -w "%{http_code}" \
  --max-time 5 \
  -H "Host: ${NGINX_HOST_HEADER}" \
  "http://${GATEWAY_HOST}/health" || echo "000")
printf "  nginx (Host: %s) -> %s (follow-redirects)\n" "$NGINX_HOST_HEADER" "$nginx_code"
if [[ "$nginx_code" != "200" && "$nginx_code" != "301" && "$nginx_code" != "308" ]]; then
  failures=$((failures + 1))
fi

echo
if [[ "$failures" -eq 0 ]]; then
  echo "RESULT: all checks passed"
  exit 0
fi

if [[ "$STRICT" == "1" ]]; then
  echo "RESULT: ${failures} check(s) failed (strict mode)" >&2
  exit 1
fi

echo "RESULT: ${failures} check(s) failed (non-strict)"
exit 1