"""TS-GW-CORS: CORS & Security Tests
Verifies CORS policy is correctly enforced and security headers are present.
"""
import requests

BASE = "https://gateway.lanonasis.com"

def test_cors_allowed_origin():
    """Allowed origin should get Access-Control-Allow-Origin header"""
    r = requests.get(f"{BASE}/api/v1/auth/status",
                     headers={"Origin": "https://dashboard.lanonasis.com"}, timeout=10)
    acao = r.headers.get("Access-Control-Allow-Origin", "")
    assert "dashboard.lanonasis.com" in acao, f"Missing CORS for allowed origin: {acao}"
    print(f"PASS: CORS allowed → dashboard.lanonasis.com reflected")

def test_cors_another_allowed():
    """Another allowed origin should work"""
    for origin in [
        "https://app.lanonasis.com",
        "https://mcp.lanonasis.com",
        "https://docs.lanonasis.com",
        "https://admin.lanonasis.com",
    ]:
        r = requests.get(f"{BASE}/api/v1/auth/status",
                         headers={"Origin": origin}, timeout=10)
        acao = r.headers.get("Access-Control-Allow-Origin", "")
        assert origin in acao, f"Missing CORS for {origin}: {acao}"
    print(f"PASS: CORS allowed → all {len(['app','mcp','docs','admin'])} origins work")

def test_cors_blocked_origin():
    """Blocked origin should NOT get origin reflected"""
    r = requests.get(f"{BASE}/api/v1/auth/status",
                     headers={"Origin": "https://evil.example.com"}, timeout=10)
    acao = r.headers.get("Access-Control-Allow-Origin", "")
    assert "evil.example.com" not in acao, f"CORS leak: {acao}"
    print(f"PASS: CORS blocked → evil.example.com not reflected")

def test_cors_localhost_allowed():
    """Localhost origins should work (development)"""
    r = requests.get(f"{BASE}/api/v1/auth/status",
                     headers={"Origin": "http://localhost:5173"}, timeout=10)
    acao = r.headers.get("Access-Control-Allow-Origin", "")
    assert "localhost" in acao, f"Missing CORS for localhost: {acao}"
    print(f"PASS: CORS allowed → localhost:5173 works")

def test_cors_preflight():
    """OPTIONS request should return 204 with CORS headers"""
    r = requests.options(f"{BASE}/api/v1/auth/status",
                         headers={"Origin": "https://dashboard.lanonasis.com",
                                  "Access-Control-Request-Method": "GET"}, timeout=10)
    assert r.status_code == 204, f"Expected 204, got {r.status_code}"
    acao = r.headers.get("Access-Control-Allow-Origin", "")
    assert "dashboard.lanonasis.com" in acao, f"Missing CORS on preflight: {acao}"
    print(f"PASS: CORS preflight → 204 with headers")

def test_cors_methods_allowed():
    """OPTIONS should list allowed methods"""
    r = requests.options(f"{BASE}/api/v1/auth/status",
                         headers={"Origin": "https://dashboard.lanonasis.com",
                                  "Access-Control-Request-Method": "GET"}, timeout=10)
    methods = r.headers.get("Access-Control-Allow-Methods", "")
    assert "GET" in methods and "POST" in methods, f"Methods missing: {methods}"
    print(f"PASS: CORS methods → {methods[:60]}...")

def test_hsts_header():
    """HSTS header should be present"""
    r = requests.get(f"{BASE}/", timeout=10)
    hsts = r.headers.get("Strict-Transport-Security", "")
    assert "max-age=31536000" in hsts, f"Missing HSTS: {hsts}"
    print(f"PASS: HSTS header present")

def test_xss_protection():
    """XSS Protection header should be present"""
    r = requests.get(f"{BASE}/", timeout=10)
    xss = r.headers.get("X-XSS-Protection", "")
    assert "1; mode=block" in xss, f"Missing XSS header: {xss}"
    print(f"PASS: X-XSS-Protection header present")

def test_content_type_options():
    """X-Content-Type-Options should be set"""
    r = requests.get(f"{BASE}/", timeout=10)
    cto = r.headers.get("X-Content-Type-Options", "")
    assert "nosniff" in cto, f"Missing nosniff: {cto}"
    print(f"PASS: X-Content-Type-Options header present")

def test_frame_options():
    """X-Frame-Options should prevent clickjacking"""
    r = requests.get(f"{BASE}/", timeout=10)
    xfo = r.headers.get("X-Frame-Options", "")
    assert xfo in ("DENY", "SAMEORIGIN"), f"Weak XFO: {xfo}"
    print(f"PASS: X-Frame-Options → {xfo}")

def test_referrer_policy():
    """Referrer-Policy should be set"""
    r = requests.get(f"{BASE}/", timeout=10)
    rp = r.headers.get("Referrer-Policy", "")
    assert rp != "", "Missing Referrer-Policy"
    print(f"PASS: Referrer-Policy → {rp}")

def test_cors_vary_header():
    """Vary: Origin should be set for CORS"""
    r = requests.get(f"{BASE}/api/v1/auth/status",
                     headers={"Origin": "https://dashboard.lanonasis.com"}, timeout=10)
    vary = r.headers.get("Vary", "")
    assert "Origin" in vary, f"Missing Vary: Origin → {vary}"
    print(f"PASS: Vary header includes Origin")

# Run all
test_cors_allowed_origin()
test_cors_another_allowed()
test_cors_blocked_origin()
test_cors_localhost_allowed()
test_cors_preflight()
test_cors_methods_allowed()
test_hsts_header()
test_xss_protection()
test_content_type_options()
test_frame_options()
test_referrer_policy()
test_cors_vary_header()
print("\n✅ TS-GW-CORS: All CORS & security tests passed")
