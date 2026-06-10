# Migration Handler Authoring Guide

> How to write a migration handler for the Onasis Gateway — covering the handler contract, rollback semantics, and how to register a new migration.

---

## Overview

A migration handler is a TypeScript module that encapsulates a single schema or configuration change. Handlers live in `src/database/migrations/`. Each handler is a paired **up + down** operation with explicit rollback support.

---

## Handler Contract

Every handler must export two named exports:

```typescript
export async function up(client: Client): Promise<void> {
  // Apply the migration
}

export async function down(client: Client): Promise<void> {
  // Roll back the migration — must restore exact prior state
}
```

### `up(client)`

- Receives a Postgres `Client` connected to the target database
- Runs the DDL atomically
- Must be idempotent — safe to run twice without error
- Throws on Must be idempotent — safe to run twice without error
- Throws on failure; transaction is rolled back automatically

### `down(client)`

- Reverses the `up` operation
- Must produce the **exact prior state** — not just something "close"
- Must be idempotent
- Throws on failure; transaction is rolled back automatically

---

## Rollback Semantics

| Scenario | What `down` must do |
|----------|---------------------|
| `CREATE TABLE` | `DROP TABLE IF EXISTS` |
| `ADD COLUMN` (nullable) | `DROP COLUMN` |
| `ADD COLUMN` (not nullable) | Restore to prior default or NULL |
| `CREATE INDEX` | `DROP INDEX` |
| `ALTER TABLE SET default` | `ALTER TABLE ALTER COLUMN SET DEFAULT <old>` |
| `INSERT seed data` | `DELETE` matching rows (use a named key) |
| `CREATE FUNCTION` | `DROP FUNCTION IF EXISTS` |

**Key rule:** rollback must be the **mirror image** of the up — same table, same column, same constraint. Do not combine multiple concerns in one handler; split them.

---

## Registration

Register the handler in the migration registry file (e.g., `database/migrations/index.ts` or a JSON manifest):

```typescript
import { v1_add_api_keys_table } from './v1_add_api_keys_table';

export const migrations = [
  {
    id: 'v1_add_api_keys_table',
    description: 'Create core.api_keys for authentication',
    up,
    down,
    appliedAt: null,   // filled in by the runner
  },
];
```

The migration runner tracks which handlers have been applied in a `schema_migrations` table:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id          TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Example: Adding a New Table

```typescript
// src/database/migrations/v2_add_rate_limits_table.ts
import type { Client } from 'pg';

export async function up(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS audit.rate_limits (
      id          TEXT PRIMARY KEY,
      api_key_id  TEXT NOT NULL REFERENCES core.api_keys(id),
      window_ms   BIGINT NOT NULL,
      max_requests BIGINT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_rate_limits_api_key
    ON audit.rate_limits(api_key_id);
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS audit.rate_limits;`);
}
```

---

## Example: Seeding Data with Rollback

```typescript
// src/database/migrations/v3_seed_default_adapters.ts
import type { Client } from 'pg';

const SEED_ID = '00000000-0000-0000-0000-000000000001';

export async function up(client: Client): Promise<void> {
  await client.query(`
    INSERT INTO onasis.adapters (id, name, version, enabled)
    VALUES ($1, 'stripe', '1.0.0', true)
    ON CONFLICT (id) DO NOTHING;
  `, [SEED_ID]);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    DELETE FROM onasis.adapters WHERE id = $1;
  `, [SEED_ID]);
}
```

---

## Testing a Handler

```bash
# Run up
node -e "
  const { up } = require('./src/database/migrations/vN_description.ts');
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.connect().then(() => up(client)).then(() => client.end());
"

# Run down (after verifying up worked)
node -e "
  const { down } = require('./src/database/migrations/vN_description.ts');
  ...
"
```

---

## Watch-outs

1. **Never mix DDL and DML** in one handler — keep them separate so rollback is precise.
2. **Use `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`** in `up` for idempotency.
3. **Use explicit row keys** in seed-data rollback — never `DELETE FROM table` without a `WHERE`.
4. **Do not hard-code UUIDs** — use `gen_random_uuid()` in `up` and track the generated value for `down` if needed, or use a named constant.
5. **Supabase safety rule:** never `supabase db push` against the live project. Apply migrations manually with reviewed SQL, then record in source control.

---

## Cross-links

- Onasis Gateway README → [README.md](../README.md)
- Onasis Gateway CLAUDE.md → [CLAUDE.md](../CLAUDE.md)
- Monorepo release docs → `/Users/seyederick/DevOps/projects/active/lan-onasis-monorepo/docs/RELEASE.md`
- Monorepo migration runbooks → `/Users/seyederick/DevOps/projects/active/lan-onasis-monorepo/docs/migrations/`
