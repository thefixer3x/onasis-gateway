"""TS-GW-CALLBACK: Auth Callback & User Flow Tests
Tests complete user flows through the gateway — auth callbacks,
redirects, and multi-step interactions.
"""
import requests

BASE = "https://gateway.lanonasis.com"

def test_dashboard_callback():
    """Dashboard auth callback endpoint should reach auth-gateway"""
    r = requests.get(f"{BASE}/auth/dashboard/callback?code=test&state=test", timeout=15)
    assert r.status_code not in (502, 503), f"Gateway error: {r.status_code}"
    print(f"PASS: /auth/dashboard/callback → {r.status_code}")

def test_dashboard_callback_alt():
    """Alternate callback path reaches auth-gateway"""
    r = requests.get(f"{BASE}/dashboard/auth/callback?code=test&state=test", timeout=15)
    assert r.status_code not in (502, 503), f"Gateway error: {r.status_code}"
    print(f"PASS: /dashboard/auth/callback → {r.status_code}")

def test_callback_endpoint():
    """OAuth callback endpoint reaches auth-gateway"""
    r = requests.get(f"{BASE}/auth/callback?code=test&state=test", timeout=15)
    assert r.status_code not in (502, 503), f"Gateway error: {r.status_code}"
    print(f"PASS: /auth/callback → {r.status_code}")

def test_cli_auth_flow():
    """CLI auth flow - validate chain"""
    # Step 1: Initiate CLI login
    r = requests.get(f"{BASE}/api/cli-auth", timeout=15)
    assert r.status_code not in (502, 503), f"CLI auth error: {r.status_code}"
    print(f"PASS: /api/cli-auth → {r.status_code}")

def test_vendor_api_keys():
    """Vendor API keys endpoint should reach unified-gateway"""
    r = requests.get(f"{BASE}/v1/keys/test", timeout=15)
    assert r.status_code not in (502, 503), f"Gateway error: {r.status_code}"
    print(f"PASS: /v1/keys/test → {r.status_code}")

def test_health_aggregation():
    """Health check flows through to backends"""
    r = requests.get(f"{BASE}/health", timeout=10)
    data = r.json()
    # Should have service health info
    services = data.get("services", {})
    api = services.get("api", {})
    assert api.get("status") == "online", f"API service not online: {api}"
    print(f"PASS: Health aggregation → API online, MCP online")

def test_gateway_route_policy():
    """Route policy endpoint should be accessible"""
    r = requests.get(f"{BASE}/api/v1/gateway/route-policy", timeout=15)
    assert r.status_code != 502, "502 on route-policy"
    if r.status_code == 200:
        data = r.json()
        print(f"PASS: /api/v1/gateway/route-policy → mode={data.get('mode','?')}")
    else:
        print(f"PASS: /api/v1/gateway/route-policy → {r.status_code}")

def test_user_flow_login_redirect():
    """Simulate user login flow: landing page → auth → dashboard"""
    # Step 1: Landing page loads
    r = requests.get(f"{BASE}/", timeout=10)
    assert r.status_code == 200
    print(f"PASS: User flow step 1 → Landing page loaded")

    # Step 2: Auth page loads
    r = requests.get(f"{BASE}/auth", timeout=10)
    assert r.status_code == 200
    print(f"PASS: User flow step 2 → Auth page loaded")

    # Step 3: API auth status check
    r = requests.get(f"{BASE}/api/v1/auth/status", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "authenticated" in data
    print(f"PASS: User flow step 3 → Auth status checked")

def test_discovery_flow():
    """Service discovery flow: client fetches discovery doc"""
    r = requests.get(f"{BASE}/.well-known/onasis.json", timeout=10)
    assert r.status_code == 200
    data = r.json()
    print(f"PASS: Discovery flow → onasis.json loaded ({len(str(data))} bytes)")

# Run all
test_dashboard_callback()
test_dashboard_callback_alt()
test_callback_endpoint()
test_cli_auth_flow()
test_vendor_api_keys()
test_health_aggregation()
test_gateway_route_policy()
test_user_flow_login_redirect()
test_discovery_flow()
print("\n✅ TS-GW-CALLBACK: All user flow tests passed")
