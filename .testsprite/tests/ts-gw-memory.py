"""TS-GW-MEMORY: Memory API Tests
Verifies memory CRUD routes work through the gateway to Supabase EFs.
"""
import requests

BASE = "https://gateway.lanonasis.com"

def test_memory_health():
    """Memory health reaches system-health EF"""
    r = requests.get(f"{BASE}/api/v1/memory/health", timeout=15)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert "status" in data
    print(f"PASS: /api/v1/memory/health → 200")

def test_memory_list_no_auth():
    """Memory list without auth should 401"""
    r = requests.post(f"{BASE}/api/v1/memory/list", json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    assert "authentication" in r.text.lower() or "error" in r.text.lower()
    print(f"PASS: /api/v1/memory/list POST → 401")

def test_memory_search_no_auth():
    """Memory search without auth should 401"""
    r = requests.post(f"{BASE}/api/v1/memory/search", json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/memory/search POST → 401")

def test_memory_get_by_id():
    """Memory get by ID without auth should 401"""
    r = requests.get(f"{BASE}/api/v1/memory/test-memory-id", timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/memory/test-memory-id GET → 401")

def test_memory_create_no_auth():
    """Memory create without auth should 401"""
    r = requests.post(f"{BASE}/api/v1/memory", json={"content": "test"}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/memory POST → 401")

def test_memory_update_no_auth():
    """Memory update without auth should 401"""
    r = requests.post(f"{BASE}/api/v1/memory/update",
                      json={"id": "test", "content": "updated"}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/memory/update POST → 401")

def test_memory_delete_no_auth():
    """Memory delete without auth should 401"""
    r = requests.post(f"{BASE}/api/v1/memory/delete",
                      json={"id": "test"}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/memory/delete POST → 401")

def test_memory_stats_no_auth():
    """Memory stats without auth should 401"""
    r = requests.post(f"{BASE}/api/v1/memory/stats", json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/memory/stats POST → 401")

def test_memories_plural_aliases():
    """Plural /api/v1/memories/* aliases work the same as singular"""
    r = requests.post(f"{BASE}/api/v1/memories", json={"content": "test"}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/memories POST → 401 (plural alias)")

def test_memories_list_alias():
    """Plural /api/v1/memories/list works"""
    r = requests.post(f"{BASE}/api/v1/memories/list", json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/memories/list POST → 401 (plural alias)")

def test_memories_get_by_id():
    """Plural /api/v1/memories/:id works"""
    r = requests.get(f"{BASE}/api/v1/memories/test-id", timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/memories/test-id GET → 401 (plural alias)")

def test_no_502_on_memory_routes():
    """No memory route should return 502"""
    routes = [
        ("GET", "/api/v1/memory/health"),
        ("POST", "/api/v1/memory/list"),
        ("POST", "/api/v1/memory/search"),
        ("GET", "/api/v1/memory/test"),
        ("POST", "/api/v1/memory"),
        ("POST", "/api/v1/memory/stats"),
    ]
    for method, path in routes:
        if method == "GET":
            r = requests.get(f"{BASE}{path}", timeout=15)
        else:
            r = requests.post(f"{BASE}{path}", json={}, timeout=15)
        assert r.status_code != 502, f"502 on {path}"
    print(f"PASS: No 502s on {len(routes)} memory routes")

# Run all
test_memory_health()
test_memory_list_no_auth()
test_memory_search_no_auth()
test_memory_get_by_id()
test_memory_create_no_auth()
test_memory_update_no_auth()
test_memory_delete_no_auth()
test_memory_stats_no_auth()
test_memories_plural_aliases()
test_memories_list_alias()
test_memories_get_by_id()
test_no_502_on_memory_routes()
print("\n✅ TS-GW-MEMORY: All memory API tests passed")
