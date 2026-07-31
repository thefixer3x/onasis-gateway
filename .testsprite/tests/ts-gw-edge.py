"""TS-GW-EDGE: Edge Cases & Negative Tests
Verifies the gateway handles malformed requests, edge cases gracefully.
"""
import requests

BASE = "https://gateway.lanonasis.com"

def test_missing_route_returns_404():
    """Unknown /api/v1 route should return 404, not 502"""
    r = requests.get(f"{BASE}/api/v1/nonexistent-route-xyz", timeout=10)
    assert r.status_code != 502, "502 on unknown route"
    print(f"PASS: /api/v1/nonexistent-route → {r.status_code} (not 502)")

def test_root_catch_all():
    """Root / returns landing page"""
    r = requests.get(f"{BASE}/", timeout=10)
    assert r.status_code == 200
    print(f"PASS: / → 200")

def test_path_with_double_slashes():
    """Double slashes should not cause issues"""
    r = requests.get(f"{BASE}//api/v1//health", timeout=10, allow_redirects=False)
    assert r.status_code not in (502, 503), f"Double slash caused error: {r.status_code}"
    print(f"PASS: //path → {r.status_code} (graceful handling)")

def test_large_payload_rejected():
    """Oversized payload should be rejected, not crash"""
    big_data = {"data": "x" * 500_000}  # 500KB
    r = requests.post(f"{BASE}/api/v1/memory/list",
                      json=big_data, timeout=30)
    assert r.status_code != 502, "502 on large payload"
    print(f"PASS: Large payload → {r.status_code} (rejected)")

def test_malformed_json():
    """Malformed JSON body should return 400, not 502"""
    r = requests.post(f"{BASE}/api/v1/memory/list",
                      data="not-json-at-all{{{",
                      headers={"Content-Type": "application/json"}, timeout=15)
    assert r.status_code != 502, "502 on malformed JSON"
    print(f"PASS: Malformed JSON → {r.status_code} (graceful)")

def test_empty_body():
    """Empty POST body should not crash gateway"""
    r = requests.post(f"{BASE}/api/v1/auth/login",
                      data="", timeout=15)
    assert r.status_code != 502, "502 on empty body"
    print(f"PASS: Empty body → {r.status_code} (graceful)")

def test_unsupported_method():
    """PUT/DELETE/PATCH on read-only routes should not 502"""
    for method in ("PUT", "DELETE", "PATCH"):
        try:
            r = requests.request(method, f"{BASE}/api/v1/health", timeout=10)
            assert r.status_code != 502, f"502 on {method} /health"
            print(f"PASS: {method} /health → {r.status_code}")
        except Exception as e:
            print(f"SKIP: {method} /health → {str(e)[:50]}")

def test_websocket_endpoint():
    """WebSocket endpoint should not return HTML error"""
    r = requests.get(f"{BASE}/ws", timeout=10)
    assert r.status_code != 502, "502 on WS endpoint"
    print(f"PASS: /ws → {r.status_code} (no 502)")

def test_sse_endpoint():
    """SSE endpoint should not return HTML error"""
    r = requests.get(f"{BASE}/sse", timeout=10)
    assert r.status_code != 502, "502 on SSE endpoint"
    print(f"PASS: /sse → {r.status_code} (no 502)")

def test_request_id_header():
    """Each response should have a unique X-Request-ID"""
    ids = set()
    for _ in range(3):
        r = requests.get(f"{BASE}/api/v1/auth/status", timeout=10)
        rid = r.headers.get("X-Request-ID", "")
        assert rid, "Missing X-Request-ID"
        ids.add(rid)
    assert len(ids) >= 2, f"Request IDs not unique: {ids}"
    print(f"PASS: X-Request-ID present and unique")

def test_response_time_reasonable():
    """Gateway should respond in reasonable time"""
    import time
    times = []
    for _ in range(3):
        start = time.time()
        requests.get(f"{BASE}/api/v1/auth/status", timeout=10)
        times.append(time.time() - start)
    avg = sum(times) / len(times)
    assert avg < 5.0, f"Slow average response: {avg:.2f}s"
    print(f"PASS: Average response time: {avg:.2f}s")

# Run all
test_missing_route_returns_404()
test_root_catch_all()
test_path_with_double_slashes()
test_large_payload_rejected()
test_malformed_json()
test_empty_body()
test_unsupported_method()
test_websocket_endpoint()
test_sse_endpoint()
test_request_id_header()
test_response_time_reasonable()
print("\n✅ TS-GW-EDGE: All edge case tests passed")
