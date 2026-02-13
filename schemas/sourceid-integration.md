# SourceID Verification – Essential Info for API Gateway Integration

Use this doc **once** to implement SourceID into your backend and gateway. Plug all ready-built endpoints, then enable only the subset you need (e.g. 52%) via config.

**End-to-end:** If you follow this doc + [ONBOARDING-APPS.md](../docs/ONBOARDING-APPS.md), you get a **working due-diligence service** end-to-end: your apps/SDKs (e.g. [v-secure privacy-sdk](https://github.com/lanonasis/v-secure/tree/main/privacy-sdk)) call the **gateway** (central point); the gateway calls your **backend**; the backend calls **SourceID**. One integration per layer; onboard new projects by giving them gateway URL + API key.

---

## 1. SourceID at a glance

| Item | Value |
|------|--------|
| **Product** | AI-powered KYC / KYB verification (identity, document, biometric, AML) |
| **Docs (known)** | https://docs.sourceid.tech/ (base); OCR: https://docs.sourceid.tech/api/verification/ocr-verification/ |
| **Auth** | `Authorization: Bearer YOUR_TOKEN` |
| **Base URL** | `{baseurl}` – get from SourceID (e.g. `https://api.sourceid.tech` or similar; confirm with provider) |
| **API prefix** | `/v1/api/` (e.g. `{baseurl}/v1/api/verification/...`) |

---

## 2. Documented endpoint (implement first)

### OCR verification

- **Method:** `POST`
- **Path:** `{baseurl}/v1/api/verification/ocr`
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <token>`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reference` | string | Yes | Unique reference for the request |
| `base64Image` | string | Yes | Base64 image (e.g. `data:image/jpeg;base64,...`) |
| `country` | string | No | e.g. `NGA` |
| `verificationLevel` | string | No | e.g. `basic` |
| `customer` | string | No | Customer ID |
| `verificationGroup` | string | No | Verification group ID |

**Response (success):**

- `status: true`, `responseCode: "00"`, `statusCode: "200"`
- `data.message`, `data.tableCount`, `data.content`:
  - `content.lines`: text lines
  - `content.tables`: table content
  - `content.forms`: form fields/values
  - `content.signatures`: signature regions

**Use cases:** document text extraction, forms, tables, signatures, receipts/invoices.

---

## 3. Capabilities to map (for full implementation later)

SourceID marketing/docs mention these; **exact paths and payloads** need to be taken from full API spec or support:

| Capability | Typical use | Map to gateway tool (if you have it) |
|------------|-------------|--------------------------------------|
| Identity document validation | ID verification | `verify_identity_document` |
| Biometric (3D liveness, face-to-ID) | Liveness / face match | `liveness_detection`, `facial_recognition` |
| AML/PEP/Sanctions screening | Compliance | `sanctions_screening`, `pep_screening` |
| Address verification (AI) | Address proof | `verify_address` |
| Government DB (Tax ID, National ID, etc.) | KYC/KYB | `verify_tax_identification`, NIN/ID checks |
| Business registry / UBO | KYB | `verify_business_registration` |
| OCR (document extraction) | Documents | **New:** `ocr_verification` (see above) |

**Action:** Get full API list from SourceID (docs or support) and map each endpoint to one of your backend routes; then expose only the ones you enable in the gateway (see §5).

---

## 4. Backend (verify.seftechub.com) – recommended pattern

- **Single integration:** Add a SourceID client in your backend (e.g. env: `SOURCEID_BASE_URL`, `SOURCEID_BEARER_TOKEN`).
- **Ready-built routes:** Implement one backend route per SourceID (or logical) capability, e.g.:
  - `POST /api/v1/verification/ocr` → calls SourceID `POST .../v1/api/verification/ocr`, returns normalized response.
  - Same for identity, liveness, sanctions, etc., when you have the spec.
- **Gateway:** Does **not** call SourceID directly. Gateway calls **your** backend only (existing verification-service adapter → `baseUrl` = verify.seftechub.com). Your backend then calls SourceID for the capabilities you’ve implemented.

This way you implement SourceID **once** in the backend and control what is exposed via the gateway’s `enabledTools` (see §5).

---

## 5. Gateway: enable only the tools you need (e.g. 52%)

- **Catalog / service config:** Each adapter can define an **optional** `enabledTools` list. If present, the gateway exposes **only** those tools; the rest are hidden and return “disabled” if called.
- **Verification-service:** Total tools today ≈ 17. To enable “52%” (e.g. 9 tools), set `enabledTools` to the 9 you need. Example “phase 1” set:

  - `verify_identity_document`
  - `verify_phone_email`
  - `verify_address`
  - `verify_business_registration`
  - `get_verification_status`
  - `list_supported_countries`
  - `get_verification_providers`
  - `facial_recognition`
  - `liveness_detection`

  (You can swap in/out any of the 17 to hit your exact 52%.)

- **Adding OCR:** When your backend has an OCR route (e.g. `POST /api/v1/verification/ocr`), add a tool `ocr_verification` in the verification adapter and append `ocr_verification` to `enabledTools` when you want it live.

---

## 6. Checklist for “do it once”

1. [ ] Get from SourceID: production `baseurl`, Bearer token, and full API list (all endpoints + request/response).
2. [ ] In backend: add SourceID client (base URL + auth); implement OCR route that proxies to SourceID OCR.
3. [ ] In backend: add more routes for the capabilities you need (identity, liveness, sanctions, etc.) as you get the specs.
4. [ ] In gateway: set `enabledTools` in verification-service config to the ~52% you want (e.g. 9 tools); leave the rest for later.
5. [ ] (Optional) Add `ocr_verification` tool to the verification adapter and backend route when ready; add it to `enabledTools` when you want it enabled.

---

## 7. Schema / config (gateway)

- **Catalog schema:** `mcpAdapter` may include optional `enabledTools: string[]`.
- **Verification service:** In `services/verification-service/verification-service.json` (or equivalent), add an `enabledTools` array; the verification adapter uses it so only those tools are exposed and callable.

After that, you only toggle tools by editing `enabledTools` (or catalog); no need to re-implement SourceID multiple times.
