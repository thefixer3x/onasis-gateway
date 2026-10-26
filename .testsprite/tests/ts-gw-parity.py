"""TS-GW-PARITY: Production Parity Smoke Tests
Compares api.lanonasis.com (via Netlify bridge/redirects) vs
gateway.lanonasis.com (direct VPS nginx) for identical behavior.
"""
import requests

OLD = "https://api.lanonasis.com"
NEW = "https://gateway.lanonasis.com"

def compare(method, path, body=None):
    kwargs = {"timeout": 15}
    if body:
        kwargs["json"] = body
    if method == "GET":
        r1 = requests.get(f"{OLD}{path}", **kwargs)
        r2 = requests.get(f"{NEW}{path}", **kwargs)
    elif method == "POST":
        r1 = requests.post(f"{OLD}{path}", **kwargs)
        r2 = requests.post(f"{NEW}{path}", **kwargs)
    return r1.status_code, r2.status_code

def test_health_parity():
    s1, s2 = compare("GET", "/health")
    assert s1 == s2 == 200, f"Parity fail: old={s1} new={s2}"
    print(f"PASS: /health → {s1} both")

def test_auth_status_parity():
    s1, s2 = compare("GET", "/api/v1/auth/status")
    assert s1 == s2, f"Parity fail: old={s1} new={s2}"
    print(f"PASS: /api/v1/auth/status → {s1} both")

def test_intelligence_health_parity():
    s1, s2 = compare("GET", "/api/v1/intelligence/health-check")
    assert s1 == s2, f"Parity fail: old={s1} new={s2}"
    print(f"PASS: /intelligence/health-check → {s1} both")

def test_memory_health_parity():
    s1, s2 = compare("GET", "/api/v1/memory/health")
    assert s1 == s2 == 200, f"Parity fail: old={s1} new={s2}"
    print(f"PASS: /memory/health → {s1} both")

def test_login_parity():
    s1, s2 = compare("POST", "/api/v1/auth/login", {"email":"x","password":"y"})
    # Accept 401 (auth needed) or 429 (rate limited) — both prove gateway routing works
    assert s1 not in (502, 503), f"Old side error: {s1}"
    assert s2 not in (502, 503), f"Gateway error: {s2}"
    print(f"PASS: /auth/login → old={s1} new={s2} (both routed correctly)")

def test_keys_list_parity():
    s1, s2 = compare("GET", "/api/v1/keys/list")
    assert s1 == s2, f"Parity fail: old={s1} new={s2}"
    print(f"PASS: /keys/list → {s1} both")

def test_memory_list_parity():
    s1, s2 = compare("POST", "/api/v1/memory/list", {})
    assert s1 == s2, f"Parity fail: old={s1} new={s2}"
    print(f"PASS: /memory/list → {s1} both")

def test_embeddings_parity():
    s1, s2 = compare("POST", "/api/v1/embeddings", {})
    assert s1 == s2, f"Parity fail: old={s1} new={s2}"
    print(f"PASS: /embeddings → {s1} both")

def test_org_parity():
    s1, s2 = compare("GET", "/api/v1/organization")
    assert s1 == s2, f"Parity fail: old={s1} new={s2}"
    print(f"PASS: /organization → {s1} both")

def test_config_parity():
    s1, s2 = compare("GET", "/api/v1/config")
    assert s1 == s2, f"Parity fail: old={s1} new={s2}"
    print(f"PASS: /config → {s1} both")

def test_projects_parity():
    s1, s2 = compare("GET", "/api/v1/projects/list")
    assert s1 == s2, f"Parity fail: old={s1} new={s2}"
    print(f"PASS: /projects/list → {s1} both")

def test_suggest_tags_parity():
    s1, s2 = compare("POST", "/api/v1/intelligence/suggest-tags", {})
    assert s1 == s2, f"Parity fail: old={s1} new={s2}"
    print(f"PASS: /suggest-tags → {s1} both")

def test_cli_login_parity():
    r1 = requests.get(f"{OLD}/auth/cli-login", timeout=15)
    r2 = requests.get(f"{NEW}/auth/cli-login", timeout=15)
    assert r1.status_code not in (502, 503), f"Old side error: {r1.status_code}"
    assert r2.status_code not in (502, 503), f"Gateway error: {r2.status_code}"
    print(f"PASS: /auth/cli-login → old={r1.status_code} new={r2.status_code}")

def test_oauth_authorize_parity():
    r1 = requests.get(f"{OLD}/oauth/authorize", timeout=15)
    r2 = requests.get(f"{NEW}/oauth/authorize", timeout=15)
    assert r1.status_code not in (502, 503), f"Old side error: {r1.status_code}"
    assert r2.status_code not in (502, 503), f"Gateway error: {r2.status_code}"
    print(f"PASS: /oauth/authorize → old={r1.status_code} new={r2.status_code}")

def test_body_match_critical():
    """Critical endpoints should return identical bodies"""
    endpoints = [
        ("GET", "/.well-known/onasis.json"),
    ]
    for method, path in endpoints:
        r1 = requests.get(f"{OLD}{path}", timeout=15)
        r2 = requests.get(f"{NEW}{path}", timeout=15)
        assert r1.text == r2.text, f"Body mismatch on {path}"
        print(f"PASS: {path} → identical body")

# Run all
test_health_parity()
test_auth_status_parity()
test_intelligence_health_parity()
test_memory_health_parity()
test_login_parity()
test_keys_list_parity()
test_memory_list_parity()
test_embeddings_parity()
test_org_parity()
test_config_parity()
test_projects_parity()
test_suggest_tags_parity()
test_cli_login_parity()
test_oauth_authorize_parity()
test_body_match_critical()
print("\n✅ TS-GW-PARITY: All parity tests passed")
