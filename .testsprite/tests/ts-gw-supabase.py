"""TS-GW-SUPABASE: Supabase Edge Function Proxy Tests
Verifies routes that proxy directly to Supabase Edge Functions work correctly.
401 is expected without auth — it proves the EF was reached, not a 502.
"""
import requests

BASE = "https://gateway.lanonasis.com"

def test_intelligence_health():
    """Intelligence health-check reaches Supabase EF"""
    r = requests.get(f"{BASE}/api/v1/intelligence/health-check", timeout=15)
    assert r.status_code == 401, f"Expected 401 (EF reached), got {r.status_code}"
    assert "error" in r.text.lower() or "authentication" in r.text.lower()
    print(f"PASS: /api/v1/intelligence/health-check → 401 (EF reached)")

def test_intelligence_suggest_tags():
    """POST suggest-tags reaches Supabase EF"""
    r = requests.post(f"{BASE}/api/v1/intelligence/suggest-tags",
                      json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/intelligence/suggest-tags → 401")

def test_intelligence_extract_insights():
    """POST extract-insights reaches Supabase EF"""
    r = requests.post(f"{BASE}/api/v1/intelligence/extract-insights",
                      json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401 (EF), got {r.status_code}"
    print(f"PASS: /api/v1/intelligence/extract-insights → 401")

def test_intelligence_find_related():
    """POST find-related reaches Supabase EF"""
    r = requests.post(f"{BASE}/api/v1/intelligence/find-related",
                      json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/intelligence/find-related → 401")

def test_intelligence_analyze_patterns():
    """POST analyze-patterns reaches Supabase EF"""
    r = requests.post(f"{BASE}/api/v1/intelligence/analyze-patterns",
                      json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/intelligence/analyze-patterns → 401")

def test_intelligence_detect_duplicates():
    """POST detect-duplicates reaches Supabase EF"""
    r = requests.post(f"{BASE}/api/v1/intelligence/detect-duplicates",
                      json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/intelligence/detect-duplicates → 401")

def test_intelligence_behavior_record():
    """POST behavior-record reaches Supabase EF"""
    r = requests.post(f"{BASE}/api/v1/intelligence/behavior-record",
                      json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/intelligence/behavior-record → 401")

def test_api_keys_list():
    """GET keys/list reaches Supabase EF"""
    r = requests.get(f"{BASE}/api/v1/keys/list", timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/keys/list → 401")

def test_api_keys_create():
    """POST keys reaches Supabase EF"""
    r = requests.post(f"{BASE}/api/v1/keys", json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/keys POST → 401")

def test_api_keys_rotate():
    """POST keys/rotate reaches Supabase EF"""
    r = requests.post(f"{BASE}/api/v1/keys/rotate", json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/keys/rotate → 401")

def test_api_keys_revoke():
    """POST keys/revoke reaches Supabase EF"""
    r = requests.post(f"{BASE}/api/v1/keys/revoke", json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/keys/revoke → 401")

def test_organization():
    """GET organization reaches Supabase EF"""
    r = requests.get(f"{BASE}/api/v1/organization", timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/organization → 401")

def test_projects_list():
    """GET projects/list reaches Supabase EF"""
    r = requests.get(f"{BASE}/api/v1/projects/list", timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/projects/list → 401")

def test_projects_create():
    """POST projects reaches Supabase EF"""
    r = requests.post(f"{BASE}/api/v1/projects", json={}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/projects POST → 401")

def test_config_get():
    """GET config reaches Supabase EF"""
    r = requests.get(f"{BASE}/api/v1/config", timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/config → 401")

def test_config_set():
    """POST config/set reaches Supabase EF"""
    r = requests.post(f"{BASE}/api/v1/config/set",
                      json={"key": "test", "value": "test"}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/config/set → 401")

def test_embeddings():
    """POST embeddings reaches Supabase EF"""
    r = requests.post(f"{BASE}/api/v1/embeddings",
                      json={"input": "test"}, timeout=15)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print(f"PASS: /api/v1/embeddings → 401")

def test_profiles():
    """GET profiles reaches Supabase EF"""
    r = requests.get(f"{BASE}/api/v1/profiles/test-id", timeout=15)
    assert r.status_code in (401, 404), f"Unexpected: {r.status_code}"
    assert r.status_code != 502, "502 Bad Gateway"
    print(f"PASS: /api/v1/profiles/test-id → {r.status_code}")

# Run all
test_intelligence_health()
test_intelligence_suggest_tags()
test_intelligence_extract_insights()
test_intelligence_find_related()
test_intelligence_analyze_patterns()
test_intelligence_detect_duplicates()
test_intelligence_behavior_record()
test_api_keys_list()
test_api_keys_create()
test_api_keys_rotate()
test_api_keys_revoke()
test_organization()
test_projects_list()
test_projects_create()
test_config_get()
test_config_set()
test_embeddings()
test_profiles()
print("\n✅ TS-GW-SUPABASE: All Supabase EF proxy tests passed")
