"""TS-GW-STATIC: Static Assets Tests
Verifies landing page, auth pages, service discovery, and asset serving.
"""
import requests

BASE = "https://gateway.lanonasis.com"

def test_landing_page():
    """Root serves index.html"""
    r = requests.get(f"{BASE}/", timeout=10)
    assert r.status_code == 200
    assert "html" in r.text.lower()
    assert "<!doctype html" in r.text.lower()[:100]
    print(f"PASS: / → 200 (landing page)")

def test_auth_page():
    """Auth page serves auth.html"""
    r = requests.get(f"{BASE}/auth", timeout=10)
    assert r.status_code == 200
    assert "html" in r.text.lower()
    print(f"PASS: /auth → 200 (auth.html)")

def test_login_page():
    """Login page serves auth.html"""
    r = requests.get(f"{BASE}/login", timeout=10)
    assert r.status_code == 200
    print(f"PASS: /login → 200")

def test_signup_page():
    """Signup page serves auth.html"""
    r = requests.get(f"{BASE}/signup", timeout=10)
    assert r.status_code == 200
    print(f"PASS: /signup → 200")

def test_service_discovery():
    """Service discovery JSON is served correctly"""
    r = requests.get(f"{BASE}/.well-known/onasis.json", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict), "Expected JSON object"
    # Should have at least a service name or identifier
    has_content = any(k in data for k in ("service", "name", "version", "services"))
    assert has_content, "Service discovery lacks expected fields"
    content_type = r.headers.get("Content-Type", "")
    assert "json" in content_type, f"Wrong Content-Type: {content_type}"
    print(f"PASS: /.well-known/onasis.json → 200 (valid JSON)")

def test_robots_txt():
    """robots.txt should be accessible"""
    r = requests.get(f"{BASE}/robots.txt", timeout=10)
    assert r.status_code in (200, 404), f"Unexpected: {r.status_code}"
    print(f"PASS: /robots.txt → {r.status_code}")

def test_favicon():
    """favicon should be accessible"""
    r = requests.get(f"{BASE}/favicon.svg", timeout=10)
    assert r.status_code in (200, 404), f"Unexpected: {r.status_code}"
    print(f"PASS: /favicon.svg → {r.status_code}")

def test_static_assets_have_cache_headers():
    """Static assets should have cache headers"""
    r = requests.get(f"{BASE}/favicon.svg", timeout=10)
    if r.status_code == 200:
        cc = r.headers.get("Cache-Control", "")
        assert "public" in cc, f"Missing public cache: {cc}"
        print(f"PASS: Static asset has cache headers")

# Run all
test_landing_page()
test_auth_page()
test_login_page()
test_signup_page()
test_service_discovery()
test_robots_txt()
test_favicon()
test_static_assets_have_cache_headers()
print("\n✅ TS-GW-STATIC: All static asset tests passed")
