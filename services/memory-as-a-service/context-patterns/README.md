# Context Patterns: Behavior Intelligence Implementation Guide

> **For AI Agents**: This guide contains step-by-step instructions to upgrade `@lanonasis/mem-intel-sdk` from v1.x to v2.0 with behavior intelligence capabilities.

## What This Adds

The "Golden Flavor" - behavioral pattern learning that:
- **Records** successful workflows as patterns
- **Recalls** relevant patterns for new tasks (local-first)
- **Suggests** next actions based on learned history

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                BEHAVIOR INTELLIGENCE v2.0                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SDK Layer (@lanonasis/mem-intel-sdk)                          │
│  ├── recordBehavior()     → Store patterns                     │
│  ├── recallBehavior()     → Query patterns (local-first)       │
│  └── suggestBehavior()    → AI-powered suggestions             │
│                                                                 │
│  MCP Server Layer                                              │
│  ├── behavior_record      → MCP tool registration              │
│  ├── behavior_recall      → Context-aware retrieval            │
│  └── behavior_suggest     → Pattern-based predictions          │
│                                                                 │
│  REST API Layer                                                │
│  ├── POST /memories       → Uses type: "workflow"              │
│  ├── POST /memories/search → Filter by workflow type           │
│  └── PUT /memories/{id}   → Update use_count                   │
│                                                                 │
│  Database Layer (Supabase)                                     │
│  └── behavior_patterns    → Vector-indexed storage             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Files

| File | Purpose | Priority |
|------|---------|----------|
| [01-sdk-upgrade-guide.md](./01-sdk-upgrade-guide.md) | TypeScript SDK changes | High |
| [02-mcp-server-upgrade.md](./02-mcp-server-upgrade.md) | MCP tool registration | High |
| [03-rest-api-upgrade.md](./03-rest-api-upgrade.md) | REST endpoint integration | Medium |
| [04-database-migration.md](./04-database-migration.md) | Supabase schema changes | High |
| [05-edge-functions.md](./05-edge-functions.md) | Edge function implementation | Medium |

## Quick Start for AI Agents

### Step 1: Run Database Migration
```bash
# Apply the behavior_patterns table migration
supabase migration new add_behavior_patterns
# Copy content from 04-database-migration.md
supabase db push
```

### Step 2: Add SDK Types
```typescript
// In core/types.ts - Add the new types from 01-sdk-upgrade-guide.md
```

### Step 3: Implement Client Methods
```typescript
// In core/client.ts - Add recordBehavior, recallBehavior, suggestBehavior
```

### Step 4: Register MCP Tools
```typescript
// In server/mcp-server.ts - Register behavior_record, behavior_recall, behavior_suggest
```

### Step 5: Bump Version
```json
{
  "name": "@lanonasis/mem-intel-sdk",
  "version": "2.0.0"
}
```

## Key Design Principles

### 1. Local-First
```typescript
// ALWAYS try local cache before API
const client = new MemoryIntelligenceClient({
  apiKey: 'lano_xxx',
  processingMode: 'offline-fallback',  // ← Critical
  enableCache: true
});
```

### 2. Backward Compatible
- All v1.x methods unchanged
- New behavior methods are additive
- No breaking changes to existing API

### 3. Existing Endpoint Reuse
- `POST /memories` with `type: "workflow"` for recording
- `POST /memories/search` with `type: "workflow"` for recall
- No new REST endpoints required for MVP

## Testing Checklist

- [ ] recordBehavior stores pattern with correct type
- [ ] recallBehavior returns semantically similar patterns
- [ ] suggestBehavior provides relevant next actions
- [ ] Local cache works offline
- [ ] Duplicate detection prevents redundant patterns
- [ ] use_count increments on recall
- [ ] All v1.x tests still pass

## Related Documents

- **Skills**: `.claude/skills/skill-behavior-memory.md` (runtime guidance)
- **Design Doc**: `.claude/skills/sdk-behavior-extension-design.md` (full spec)
- **API Spec**: `lanonasis-mcp-rest-api.yaml` (OpenAPI)

## Version History

| Version | Changes |
|---------|---------|
| 2.0.0 | Add behavior intelligence (recordBehavior, recallBehavior, suggestBehavior) |
| 1.1.0 | Current stable release |
