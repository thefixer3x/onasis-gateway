---
name: sdk-behavior-extension
description: "Design guidance for extending @lanonasis/mem-intel-sdk with behavior intelligence, including types, client methods, MCP tools, and schema changes. Use when planning or implementing SDK behavior extensions."
---

# SDK Extension Design: Behavior Intelligence for mem-intel-sdk v2.0

## Overview

This document outlines the extension of `@lanonasis/mem-intel-sdk` to support behavioral pattern learning - the "golden flavor" that records user workflows and replays them in future sessions.

## Design Principles

1. **Local-First** - Use cached embeddings for pattern matching, API as fallback
2. **Non-Breaking** - All new features are additive, existing API unchanged
3. **Same Backend** - Leverage existing Supabase tables + minimal schema additions
4. **Minimal Footprint** - No new dependencies beyond what exists

## Current SDK Structure

```
@lanonasis/mem-intel-sdk/
├── dist/
│   ├── core/
│   │   ├── client.js          # MemoryIntelligenceClient
│   │   ├── types.js           # TypeScript definitions
│   │   └── errors.js          # Error classes
│   ├── server/
│   │   └── index.js           # MCP Server (createMCPServer)
│   ├── utils/
│   │   ├── similarity.js      # cosineSimilarity()
│   │   ├── embeddings.js      # Embedding utilities
│   │   ├── http-client.js     # HttpClient with cache
│   │   └── response-adapter.js # ResponseCache
│   ├── react/                 # React hooks
│   ├── vue/                   # Vue composables
│   └── node/                  # Node.js entry
```

## Proposed Extensions

### 1. New Types (`core/types.ts`)

```typescript
export type BehaviorOutcome = 'success' | 'partial' | 'failed';

export interface ToolAction {
  tool: string;
  parameters: Record<string, any>;
  outcome: BehaviorOutcome;
  timestamp: string;
  duration_ms?: number;
}

export interface WorkflowPattern {
  id: string;
  user_id: string;
  trigger: string;
  trigger_embedding?: number[];
  context: {
    directory: string;
    project_type?: string;
    branch?: string;
    files_touched?: string[];
  };
  actions: ToolAction[];
  final_outcome: BehaviorOutcome;
  confidence: number;
  use_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BehaviorRecordParams {
  userId: string;
  trigger: string;
  context: {
    directory: string;
    projectType?: string;
    branch?: string;
    filesTouched?: string[];
  };
  actions: ToolAction[];
  finalOutcome: BehaviorOutcome;
  confidence?: number;
}

export interface BehaviorRecallParams {
  userId: string;
  context: {
    currentDirectory: string;
    currentTask: string;
    projectType?: string;
  };
  limit?: number;
  similarityThreshold?: number;
}
```

### 2. Client Extension (`core/client.ts`)

```typescript
/**
 * Record a successful workflow pattern for future recall
 */
async recordBehavior(params: BehaviorRecordParams): Promise<{
  data: WorkflowPattern;
  usage?: UsageInfo;
}> {
  // First check for duplicates locally
  if (this.processingMode === 'offline-fallback' && this.cache) {
    const existing = await this.findSimilarBehavior(params.trigger, params.userId);
    if (existing && existing.similarity > 0.95) {
      // Update use_count instead of creating duplicate
      return this.updateBehaviorUsage(existing.id);
    }
  }

  const response = await this.httpClient.postEnhanced(
    '/intelligence/behavior/record',
    {
      user_id: params.userId,
      trigger: params.trigger,
      context: params.context,
      actions: params.actions,
      final_outcome: params.finalOutcome,
      confidence: params.confidence || 0.7
    }
  );

  return { data: response.data, usage: response.usage };
}

/**
 * Recall relevant behavior patterns for current context
 */
async recallBehavior(params: BehaviorRecallParams): Promise<{
  data: BehaviorRecallResult;
  usage?: UsageInfo;
  fromCache?: boolean;
}> {
  // Try local cache first
  if (this.processingMode === 'offline-fallback' && this.cache) {
    const cached = await this.localBehaviorSearch(params);
    if (cached.patterns.length > 0) {
      return { data: cached, fromCache: true };
    }
  }

  const response = await this.httpClient.postEnhanced(
    '/intelligence/behavior/recall',
    {
      user_id: params.userId,
      context: params.context,
      limit: params.limit || 5,
      similarity_threshold: params.similarityThreshold || 0.7
    }
  );

  return { data: response.data, usage: response.usage, fromCache: false };
}
```

### 3. MCP Tools

New tools for v2.0:
- `behavior_record` - Record a successful workflow pattern
- `behavior_recall` - Recall relevant patterns for current context
- `behavior_suggest` - Get AI-powered suggestions for next actions

### 4. Database Schema (Supabase Migration)

```sql
CREATE TABLE IF NOT EXISTS public.behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL,
  trigger_embedding VECTOR(1536),
  context JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '[]',
  final_outcome TEXT NOT NULL CHECK (final_outcome IN ('success', 'partial', 'failed')),
  confidence FLOAT NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  use_count INT NOT NULL DEFAULT 1,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vector similarity index for semantic search
CREATE INDEX behavior_patterns_embedding_idx
  ON public.behavior_patterns
  USING ivfflat (trigger_embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS policies
ALTER TABLE public.behavior_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patterns" ON public.behavior_patterns
  FOR SELECT USING (auth.uid() = user_id);
```

## Migration Path

### For Existing Users

```typescript
// v1.x - No changes needed, existing methods unchanged
const client = new MemoryIntelligenceClient({ apiKey: 'lano_xxx' });
await client.analyzePatterns({ userId, timeRangeDays: 30 });

// v2.0 - New behavior methods available
await client.recordBehavior({ userId, trigger, context, actions, finalOutcome });
await client.recallBehavior({ userId, context });
await client.suggestBehavior({ userId, currentState });
```

## Release Checklist

- [ ] Add new types to `core/types.ts`
- [ ] Implement client methods in `core/client.ts`
- [ ] Register MCP tools in `server/mcp-server.ts`
- [ ] Run Supabase migration
- [ ] Deploy edge functions
- [ ] Update documentation
- [ ] Bump version to 2.0.0
- [ ] Publish to npm
