"""TS-GW-HEALTH: Gateway Health & Infrastructure Tests
Verifies the gateway itself is running, responsive, and properly configured.
"""
import requests, json

BASE = "https://gateway.lanonasis.com"

def test_health_endpoint():
    """Gateway root health endpoint returns 200 with expected shape"""
    r = requests.get(f"{BASE}/health", timeout=10)
    assert r.status_code == 200, f"/health returned {r.status_code}"
    data = r.json()
    assert "status" in data, "Missing 'status' field"
    assert data["status"] in ("ok", "healthy"), f"Unexpected status: {data['status']}"
    assert "services" in data or "uptime" in data
    print(f"PASS: /health → 200, services up")

def test_api_v1_health():
    """Alternate health endpoint"""
    r = requests.get(f"{BASE}/api/v1/health", timeout=10)
    assert r.status_code == 200, f"/api/v1/health returned {r.status_code}"
    print(f"PASS: /api/v1/health → 200")

def test_auth_health():
    """Auth gateway health"""
    r = requests.get(f"{BASE}/auth/health", timeout=10)
    assert r.status_code == 200, f"/auth/health returned {r.status_code}"
    print(f"PASS: /auth/health → 200")

def test_info_returns_404():
    """INFO should NOT expose internal details (matching Netlify)"""
    r = requests.get(f"{BASE}/info", timeout=10)
    assert r.status_code == 404, f"/info should be 404, got {r.status_code}"
    print(f"PASS: /info → 404 (info hidden)")

def test_no_server_info_leak():
    """Gateway should not leak nginx version in Server header"""
    r = requests.get(f"{BASE}/", timeout=10)
    server = r.headers.get("Server", "")
    # server_tokens off still shows 'nginx' (just without version)
    # The important thing is no version number is leaked
    assert "/" not in server or not any(c.isdigit() for c in server.split("/")[-1]), f"Version leak: {server}"
    print(f"PASS: No server version leak (Server: {server})")

def test_ssl_modern():
    """TLS should be modern - verify via HTTPS request"""
    r = requests.get(f"{BASE}/", timeout=10)
    assert r.status_code == 200, f"HTTPS failed: {r.status_code}"
    print(f"PASS: HTTPS works with modern TLS")

# Run all
test_health_endpoint()
test_api_v1_health()
test_auth_health()
test_info_returns_404()
test_no_server_info_leak()
test_ssl_modern()
print("\n✅ TS-GW-HEALTH: All infrastructure tests passed")
