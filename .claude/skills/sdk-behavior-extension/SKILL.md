---
name: sdk-behavior-extension
description: Use this skill when adding new methods, tools, or schema changes to the `@lanonasis/mem-intel-sdk`. Trigger when the user wants to extend the SDK with new capabilities, add a new MCP tool to mcp-core, add a new intelligence endpoint, or migrate the behavior_patterns schema. Also trigger when the user says things like "add a new tool to the SDK", "extend mem-intel-sdk", "add behavior X to the MCP server", or "update the SDK schema." Do NOT use for general behavior pattern recording/recall — use the behavior-memory skill for that.
---

# Skill: Extend mem-intel-sdk

## Purpose

Step-by-step guide for **safely adding new capabilities** to `@lanonasis/mem-intel-sdk` without breaking existing consumers.

**Core principle**: All extensions are additive. Existing API surface is never modified.

---

## Before You Start — Run explore-first

```bash
# Confirm current SDK structure
ls packages/mem-intel-sdk/src/
cat packages/mem-intel-sdk/package.json | grep '"version"'

# Check what MCP tools already exist
grep -r "server.tool\|registerTool" apps/mcp-core/src/ 2>/dev/null

# Check existing types
cat packages/mem-intel-sdk/src/core/types.ts
```

Do not add anything that already exists.

---

## SDK File Map

```
packages/mem-intel-sdk/src/
├── core/
│   ├── client.ts          ← Add new client methods here
│   ├── types.ts           ← Add new types/interfaces here
│   └── errors.ts          ← Add new error classes here
├── server/
│   └── mcp-server.ts      ← Register new MCP tools here
└── utils/
    ├── similarity.ts
    ├── embeddings.ts
    └── http-client.ts
```

---

## Step-by-Step Extension Workflow

### 1. Add Types (`core/types.ts`)

```typescript
// Always export new types — never modify existing ones
export interface MyNewFeatureParams {
  userId: string;
  // ... new fields
}

export interface MyNewFeatureResult {
  data: MyNewFeatureItem[];
  usage?: UsageInfo;
  fromCache?: boolean;
}
```

### 2. Add Client Method (`core/client.ts`)

```typescript
/**
 * [Describe what this method does]
 * @param params - MyNewFeatureParams
 */
async myNewFeature(params: MyNewFeatureParams): Promise<MyNewFeatureResult> {
  // 1. Check local cache first
  if (this.processingMode === 'offline-fallback' && this.cache) {
    const cached = await this.localSearch(params);
    if (cached.data.length > 0) {
      return { ...cached, fromCache: true };
    }
  }

  // 2. Fall back to API
  const response = await this.httpClient.postEnhanced(
    '/intelligence/my-new-endpoint',
    { user_id: params.userId, /* ...params */ }
  );

  return { data: response.data, usage: response.usage, fromCache: false };
}
```

### 3. Register MCP Tool (`server/mcp-server.ts`)

```typescript
server.tool(
  'my_new_tool',
  'Brief description of what this tool does and when to use it',
  {
    user_id: z.string().uuid().describe('User UUID'),
    // ... other params with z.schema()
  },
  async ({ user_id, ...params }) => {
    const result = await client.myNewFeature({ userId: user_id, ...params });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  }
);
```

### 4. Add Supabase Migration (if schema change needed)

```sql
-- migrations/YYYYMMDD_add_my_feature.sql
-- Always: add columns/tables, never drop or rename

ALTER TABLE public.behavior_patterns
  ADD COLUMN IF NOT EXISTS my_new_field TEXT;

-- For new tables
CREATE TABLE IF NOT EXISTS public.my_new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.my_new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own records" ON public.my_new_table
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
```

Apply via:
```bash
supabase db push
# or via Supabase MCP: apply_migration
```

### 5. Bump Version & Publish

```bash
# In packages/mem-intel-sdk/
npm version minor   # new feature = minor bump
npm run build
npm publish --access public
```

---

## Behavior Patterns Schema Reference

Current `behavior_patterns` table columns:

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → auth.users |
| `trigger` | TEXT | Natural language trigger |
| `trigger_embedding` | VECTOR(1536) | For semantic recall |
| `context` | JSONB | `{directory, project_type, branch, files_touched}` |
| `actions` | JSONB | Array of `ToolAction` |
| `final_outcome` | TEXT | `success \| partial \| failed` |
| `confidence` | FLOAT | 0.0–1.0 |
| `use_count` | INT | Incremented on reuse |
| `last_used_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**BehaviorRecallResult type:**
```typescript
export interface BehaviorRecallResult {
  patterns: WorkflowPattern[];
  total: number;
  fromCache: boolean;
  suggestions?: string[];  // AI-generated next-action hints
}
```

---

## Non-Breaking Checklist

Before opening a PR:

- [ ] New types exported, no existing types modified
- [ ] New client method added, no existing method signatures changed
- [ ] MCP tool registered with clear name and description
- [ ] Migration is additive only (`ADD COLUMN IF NOT EXISTS`, no drops)
- [ ] `processingMode: 'offline-fallback'` respected in new method
- [ ] Version bumped appropriately (minor for new feature, patch for fix)
- [ ] `npm run build` passes with no TypeScript errors
