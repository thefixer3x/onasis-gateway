# Postman Local Sync Layout

Use this directory for local Postman export, sync, and archival artifacts that should live in the repo in a predictable place.

## Structure

```text
references/postman/
  canonical/
    gateway/
    auth-gateway/
    memory-service/
  provider-intake/
    payments/
    work-productivity/
    crm-forms-scheduling/
    developer-collaboration/
    messaging/
  archive/
```

## Rules

- `canonical/` is for owned Onasis collections only.
- `provider-intake/` is for imported third-party collections and comparison material.
- `archive/` is for historical snapshots.
- Do not commit plaintext secrets in collections or environment exports.
- Prefer placeholders and approved secret-loading workflows.
- Follow `/Users/seyederick/onasis-gateway/docs/plans/2026-04-23-postman-operating-playbook.md`.
