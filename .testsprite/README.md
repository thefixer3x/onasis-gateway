# Gateway UAT — TestSprite Test Suite

**Project:** LanOnasis API Integration
**Dashboard:** https://www.testsprite.com/dashboard/projects/976e4643-c1cc-42ae-a7c4-29adfc46b71d/tests

## Test Inventory (Source of Truth)

| ID | Test | Coverage | Status |
|---|---|---|---|
| `d89dad56` | TS-GW-HEALTH | Gateway health, SSL, uptime, no info leak | ✅ Passed |
| `a9f01b3f` | TS-GW-STATIC | Landing page, auth pages, service discovery, robots.txt, favicon | ✅ Passed |
| `b5c7abb2` | TS-GW-AUTH | Login, logout, OAuth, CLI auth, API keys, introspection, verify | ✅ Passed |
| `24ffd57b` | TS-GW-SUPABASE | 18 endpoint tests across intelligence, keys, org, projects, config, embeddings, profiles | ✅ Passed |
| `f4fd515a` | TS-GW-MEMORY | CRUD operations, health, search, plural aliases, no-502 check | ✅ Passed |
| `4e597cba` | TS-GW-CORS | Allowed/blocked origins, preflight, methods, vary, HSTS, XSS, XFO, nosniff | ✅ Passed |
| `d21bb90b` | TS-GW-EDGE | Missing routes, large payloads, malformed JSON, double slashes, WS/SSE, request IDs | ✅ Passed |
| `e2504732` | TS-GW-PARITY | Production parity: 14 route comparisons api vs gateway | ✅ Passed |
| `c3f8f327` | TS-GW-CALLBACK | Dashboard callback, OAuth callback, CLI flow, vendor keys, user flow simulation | ✅ Passed |

## Test source files

Located in `.testsprite/tests/` — each file is a standalone Python backend test usable with the TestSprite CLI.

```bash
# Run all tests
testsprite test run --all --project 976e4643-c1cc-42ae-a7c4-29adfc46b71d --wait --max-concurrency 4

# Run a single test
testsprite test run <test-id> --wait --timeout 120

# View latest result
testsprite test result <test-id>

# Run specific tests by filter
testsprite test run --all --project 976e4643-c1cc-42ae-a7c4-29adfc46b71d --filter "TS-GW-AUTH"

# Compare two runs
testsprite test diff <run-a> <run-b>
```

## Scheduled monitoring

Use the TestSprite Web Portal to set up schedules:
1. Open https://www.testsprite.com/dashboard/projects/976e4643-c1cc-42ae-a7c4-29adfc46b71d/tests
2. Create Test Lists to group related tests
3. Set up Schedules for daily/hourly re-runs
4. Monitor pass/fail trends over time

## Deployment

All 9 tests passed against `gateway.lanonasis.com`. The gateway is handling bridged traffic from `api.lanonasis.com` via Netlify `_redirects` with zero 502/503 errors across all route families. DNS cutover is UAT-cleared.
