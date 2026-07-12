#!/usr/bin/env bash
# compare-responses.sh — Netlify-vs-gateway response parity check.
#
# Phase 1 shadow-mode deliverable (SDK-17). Sends identical read-only requests
# to both the Netlify edge (api.lanonasis.com) and the Nginx gateway
# (gateway.lanonasis.com) and compares HTTP status codes. Mismatches are
# surfaced as MISMATCH lines; matches as OK lines.
#
# Phase 1 gate: all route groups must show <1% divergence before Phase 2.
#
# Usage:
#   ./scripts/compare-responses.sh
#   NETLIFY_BASE=https://api.lanonasis.com GATEWAY_BASE=https://gateway.lanonasis.com \
#     ./scripts/compare-responses.sh
#
# Exit codes:
#   0  All routes matched
#   1  At least one mismatch
#   2  Required tooling missing

set -euo pipefail

NETLIFY_BASE="${NETLIFY_BASE:-https://api.lanonasis.com}"
GATEWAY_BASE="${GATEWAY_BASE:-https://gateway.lanonasis.com}"

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required" >&2
  exit 2
fi

# Read-only endpoints that must remain reachable during shadow mode.
# Health/status endpoints only — never compare authenticated or mutating paths.
ENDPOINTS=(
  "/health"
  "/api/v1/auth/status"
  "/api/v1/memory/health"
  "/api/v1/intelligence/health-check"
  "/api/adapters"
)

mismatches=0
total=0

echo "=== response parity: netlify vs gateway ==="
printf "netlify=%s  gateway=%s\n\n" "$NETLIFY_BASE" "$GATEWAY_BASE"

for endpoint in "${ENDPOINTS[@]}"; do
  total=$((total + 1))
  netlify_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${NETLIFY_BASE}${endpoint}" || echo "000")
  gateway_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${GATEWAY_BASE}${endpoint}" || echo "000")
  if [[ "$netlify_code" != "$gateway_code" ]]; then
    printf "  [MISMATCH] %-40s netlify=%s gateway=%s\n" "$endpoint" "$netlify_code" "$gateway_code"
    mismatches=$((mismatches + 1))
  else
    printf "  [  OK   ] %-40s %s\n" "$endpoint" "$gateway_code"
  fi
done

echo
echo "summary: $((total - mismatches))/${total} matched"

if [[ "$mismatches" -eq 0 ]]; then
  exit 0
fi

pct=$(awk -v m="$mismatches" -v t="$total" 'BEGIN{printf "%.2f", (m/t)*100}')
echo "divergence: ${pct}% (gate: <1.0%)"
exit 1