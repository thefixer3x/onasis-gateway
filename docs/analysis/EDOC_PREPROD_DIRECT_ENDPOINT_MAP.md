# EDOC Preprod Direct Endpoint Map (SDK-Bypass)

Date: 2026-02-13

## Source

Observed from three sources:
- Published Postman Documenter collection:
  - `https://documenter.getpostman.com/view/21424784/2s9YJdUgXJ`
  - Backing API payload:
    - `https://documenter.gw.postman.com/api/collections/21424784/2s9YJdUgXJ?environment=6983889-a7b8fc54-a835-4b5f-ac5c-2ca129a79618&segregateAuth=true&versionTag=latest`
- Live frontend assets and Atlas session context:
- Portal UI: `https://preprod.api.e-doconline.ng/api-business-partner`
- Frontend bundle: `https://preprod.api.e-doconline.ng/static/js/main.616c9c26.js`
- API base found in bundle: `https://preprod.connect.e-doconline.ng/api/v1`
- Repo Supabase route/deployment inventory:
  - `docs/architecture/supabase-api/DIRECT_API_ROUTES.md`
  - `docs/architecture/supabase-api/DEPLOYED_FUNCTIONS.json`

## Confirmed Approach

This aligns with your chosen model:
- Do not wrap EDOC SDK in gateway adapter runtime.
- Use direct HTTP endpoints extracted from EDOC's own implementation contracts.

## Contract Surfaces (Important Split)

### A) Public "FOR CLIENTS" Collection (authoritative for external client integration)

Collection request count: `6`

1. `GET /external/consent/byUser?email=...`
2. `POST /external/consent/initialize`
3. `GET /external/consent/:id`
4. `DELETE /external/consent/:id`
5. `GET /external/consent/:consentId/dashboard`
6. `POST <YOUR_WEBHOOK_URL>` (sample inbound webhook payload)

Base URL in collection:
- `https://preprod.connect.e-doconline.ng/api/v1`

Headers seen in collection:
- `client-id: ZGVtb19jbGllbnQ=` (sample value in docs)

### B) Portal/Internal Business Partner API (broader operational surface)

Examples extracted from portal JS:
- `businessPartner/apiUsers/login`
- `businessPartner/getProfileData`
- `businessPartner/getExternalConsentByBusiness`
- `businessPartner/getCSVStatementUrlForBOI`
- `businessPartner/walletDetails`
- `businessPartner/verifyKYCDetails`
- `businessPartner/updateKYC`
- `businessPartner/uploadKYCDocument`

This surface is valid, but it is a different contract from the small "FOR CLIENTS" collection.

## Supabase EDOC Function Presence (Repo Inventory)

EDOC-related functions present and active in `DEPLOYED_FUNCTIONS.json` include:
- `edoc`
- `edocWebhook`
- `edoc-webhook`
- `edoc-dashboard`
- `edoc-consent`
- `edoc-transactions`
- `etl-daily-edoc`
- `consent-status`
- `delete-consent`
- `init-consent`

## Practical Adapter Mapping Implication

For `services/edoc-external-app-integration---for-clients-postman-collection`, use the public collection surface (6 tools) as primary source of truth:
- `edoc:init_consent` -> `POST /external/consent/initialize`
- `edoc:get_user_consents` -> `GET /external/consent/byUser`
- `edoc:get_consent` -> `GET /external/consent/:id`
- `edoc:delete_consent` -> `DELETE /external/consent/:id`
- `edoc:get_dashboard` -> `GET /external/consent/:consentId/dashboard`
- `edoc:webhook_sample_contract` -> sample schema/documentation tool

Then map these actions to Supabase wrappers where applicable:
- `init-consent`
- `consent-status`
- `delete-consent`
- `edoc-dashboard`
- `edoc-webhook` / `edocWebhook`

## Remaining Gaps (Need Sandbox Network Capture)

Still required to finalize executable adapter schemas:
1. Exact request body schema per endpoint.
2. Response schema and error schema per endpoint.
3. Token issuance/refresh behavior and expiry semantics.
4. Required headers beyond `client-id` in real production calls.
5. Which Supabase function is authoritative per external endpoint in your current deployment.

Recommended next capture:
- Export HAR for one successful flow each:
  - initialize consent
  - fetch consent by id
  - fetch dashboard by consent id
