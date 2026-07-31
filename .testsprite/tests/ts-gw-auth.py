"""TS-GW-AUTH: Authentication Gateway Tests
Verifies auth routes reach the canonical auth-gateway with correct responses.
401 is expected when no credentials provided — it proves the backend was reached.
"""
import requests

BASE = "https://gateway.lanonasis.com"

def test_auth_status():
    """Auth status returns current state (no auth = not authenticated)"""
    r = requests.get(f"{BASE}/api/v1/auth/status", timeout=10)
    assert r.status_code in (200, 401), f"Unexpected: {r.status_code}"
    data = r.json()
    assert "authenticated" in data, "Missing authenticated field"
    assert data["authenticated"] is False, "Should show not authenticated"
    print(f"PASS: /api/v1/auth/status → 200, not authenticated")

def test_auth_login_without_credentials():
    """Login without credentials should fail with proper error"""
    r = requests.post(f"{BASE}/api/v1/auth/login",
                      json={"email": "test@test.com", "password": "wrong"},
                      timeout=15)
    assert r.status_code in (400, 401, 429), f"Unexpected: {r.status_code} (rate limited?)"
    print(f"PASS: /api/v1/auth/login POST → {r.status_code} (expected auth or rate limit)")

def test_auth_logout():
    """Logout endpoint should be reachable"""
    r = requests.post(f"{BASE}/api/v1/auth/logout", timeout=15)
    assert r.status_code not in (502, 503), f"Gateway error: {r.status_code}"
    print(f"PASS: /api/v1/auth/logout → {r.status_code}")

def test_oauth_authorize():
    """OAuth authorize endpoint reaches auth-gateway"""
    r = requests.get(f"{BASE}/oauth/authorize", timeout=15)
    assert r.status_code not in (502, 503, 404), f"Unexpected: {r.status_code}"
    print(f"PASS: /oauth/authorize → {r.status_code}")

def test_oauth_token():
    """OAuth token endpoint reaches auth-gateway"""
    r = requests.post(f"{BASE}/oauth/token",
                      json={"grant_type": "authorization_code"}, timeout=15)
    assert r.status_code not in (502, 503), f"Gateway error: {r.status_code}"
    print(f"PASS: /oauth/token → {r.status_code}")

def test_cli_login():
    """CLI login endpoint reaches auth-gateway"""
    r = requests.get(f"{BASE}/auth/cli-login", timeout=15)
    assert r.status_code != 502, "502 Bad Gateway"
    print(f"PASS: /auth/cli-login → {r.status_code}")

def test_api_keys_management():
    """API key management routes reach auth-gateway"""
    r = requests.get(f"{BASE}/api/v1/api-keys", timeout=15)
    assert r.status_code in (401, 200), f"Unexpected: {r.status_code}"
    print(f"PASS: /api/v1/api-keys GET → {r.status_code}")

def test_api_key_create():
    """API key creation reaches auth-gateway"""
    r = requests.post(f"{BASE}/api/v1/api-keys",
                      json={"name": "test-key"}, timeout=15)
    assert r.status_code not in (502, 503), f"Gateway error: {r.status_code}"
    print(f"PASS: /api/v1/api-keys POST → {r.status_code}")

def test_auth_introspect():
    """Token introspection endpoint reachable"""
    r = requests.post(f"{BASE}/api/v1/auth/introspect", timeout=15)
    assert r.status_code not in (502, 503), f"Gateway error: {r.status_code}"
    print(f"PASS: /api/v1/auth/introspect → {r.status_code}")

def test_auth_verify():
    """Auth verify endpoint reachable"""
    r = requests.get(f"{BASE}/auth/verify", timeout=15)
    assert r.status_code not in (502, 503), f"Gateway error: {r.status_code}"
    print(f"PASS: /auth/verify → {r.status_code}")

def test_v1_auth_routes():
    """Legacy /v1/auth/* routes reach auth-gateway"""
    r = requests.get(f"{BASE}/v1/auth/session", timeout=15)
    assert r.status_code not in (502, 503), f"Gateway error: {r.status_code}"
    print(f"PASS: /v1/auth/session → {r.status_code}")

def test_security_headers_present():
    """Auth routes should have security headers"""
    r = requests.get(f"{BASE}/api/v1/auth/status", timeout=10)
    hsts = r.headers.get("Strict-Transport-Security", "")
    assert "max-age" in hsts, f"Missing HSTS: {hsts}"
    print(f"PASS: Security headers present (HSTS)")

# Run all
test_auth_status()
test_auth_login_without_credentials()
test_auth_logout()
test_oauth_authorize()
test_oauth_token()
test_cli_login()
test_api_keys_management()
test_api_key_create()
test_auth_introspect()
test_auth_verify()
test_v1_auth_routes()
test_security_headers_present()
print("\n✅ TS-GW-AUTH: All auth gateway tests passed")
