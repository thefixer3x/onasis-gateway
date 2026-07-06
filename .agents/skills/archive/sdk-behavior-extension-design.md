---
name: sdk-behavior-extension-design
description: Design guidance for extending @lanonasis/mem-intel-sdk with behavior intelligence and workflow memory APIs. Use when planning or implementing SDK behavior extensions.
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
// Add to existing types

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

export interface BehaviorSuggestParams {
  userId: string;
  currentState: {
    taskDescription: string;
    completedSteps: string[];
    currentFiles?: string[];
  };
  maxSuggestions?: number;
}

export interface BehaviorRecallResult {
  patterns: Array<{
    pattern: WorkflowPattern;
    similarity_score: number;
    relevance_reason: string;
  }>;
  total_found: number;
}

export interface BehaviorSuggestion {
  action: string;
  tool: string;
  confidence: number;
  based_on_patterns: string[];
  reasoning: string;
}
```

### 2. Client Extension (`core/client.ts`)

```typescript
// Add to MemoryIntelligenceClient class

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

  if (response.error) {
    throw new DatabaseError(`Failed to record behavior: ${response.error.message}`);
  }

  return {
    data: response.data,
    usage: response.usage
  };
}

/**
 * Private helper: increment usage for an existing pattern
 */
private async updateBehaviorUsage(patternId: string): Promise<{
  data: WorkflowPattern;
  usage?: UsageInfo;
}> {
  const response = await this.httpClient.postEnhanced(
    '/intelligence/behavior/update-usage',
    { pattern_id: patternId }
  );

  if (response.error) {
    throw new DatabaseError(response.error.message);
  }

  return { data: response.data, usage: response.usage };
}

/**
 * Recall relevant behavior patterns for current context
 * Uses local-first approach with cached embeddings
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

  if (response.error) {
    throw new DatabaseError(`Failed to recall behavior: ${response.error.message}`);
  }

  // Cache for future local queries
  if (this.cache && response.data) {
    this.cacheBehaviorPatterns(response.data.patterns);
  }

  return {
    data: response.data,
    usage: response.usage,
    fromCache: false
  };
}

/**
 * Get AI-powered suggestions for next actions
 */
async suggestBehavior(params: BehaviorSuggestParams): Promise<{
  data: { suggestions: BehaviorSuggestion[] };
  usage?: UsageInfo;
}> {
  const response = await this.httpClient.postEnhanced(
    '/intelligence/behavior/suggest',
    {
      user_id: params.userId,
      current_state: params.currentState,
      max_suggestions: params.maxSuggestions || 3
    }
  );

  if (response.error) {
    throw new DatabaseError(`Failed to suggest behavior: ${response.error.message}`);
  }

  return {
    data: response.data,
    usage: response.usage
  };
}

// Private helper methods

private async localBehaviorSearch(params: BehaviorRecallParams): Promise<BehaviorRecallResult> {
  const cachedPatterns = this.cache?.get('behavior_patterns') || [];

  // Filter by context
  const contextMatches = cachedPatterns.filter((p: WorkflowPattern) => {
    if (params.context.projectType && p.context.project_type !== params.context.projectType) {
      return false;
    }
    return true;
  });

  // Semantic search on trigger text (using cached embeddings)
  const taskEmbedding = await this.getEmbedding(params.context.currentTask);
  const embeddingDim = Array.isArray(taskEmbedding) ? taskEmbedding.length : 0;

  const validEmbeddingMatches = contextMatches.filter((p: WorkflowPattern) => {
    return (
      embeddingDim > 0 &&
      Array.isArray(p.trigger_embedding) &&
      p.trigger_embedding.length === embeddingDim
    );
  });

  const skippedInvalidEmbeddings = contextMatches.length - validEmbeddingMatches.length;

  const scored = validEmbeddingMatches.map((p: WorkflowPattern) => ({
    pattern: p,
    similarity_score: cosineSimilarity(taskEmbedding, p.trigger_embedding),
    relevance_reason: `Matched trigger: "${p.trigger.substring(0, 50)}..."`
  }));

  // Filter by threshold and sort
  const filtered = scored
    .filter(s => s.similarity_score >= (params.similarityThreshold || 0.7))
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, params.limit || 5);

  return {
    patterns: filtered,
    total_found: filtered.length,
    skipped_invalid_embeddings: skippedInvalidEmbeddings
  };
}

private cacheBehaviorPatterns(patterns: WorkflowPattern[]): void {
  const existing = this.cache?.get('behavior_patterns') || [];
  const merged = [...existing];

  for (const p of patterns) {
    const idx = merged.findIndex(e => e.id === p.id);
    if (idx >= 0) {
      merged[idx] = p;
    } else {
      merged.push(p);
    }
  }

  this.cache?.set('behavior_patterns', merged);
}
```

### 3. MCP Server Extension (`server/mcp-server.ts`)

```typescript
// Add to createMCPServer function

server.registerTool(
  'behavior_record',
  {
    title: 'Record Behavior Pattern',
    description: 'Record a successful workflow pattern for future recall and learning.',
    inputSchema: z.object({
      user_id: z.string().uuid(),
      trigger: z.string().min(10).max(500),
      context: z.object({
        directory: z.string(),
        project_type: z.string().optional(),
        branch: z.string().optional(),
        files_touched: z.array(z.string()).optional()
      }),
      actions: z.array(z.object({
        tool: z.string(),
        parameters: z.record(z.any()),
        outcome: z.enum(['success', 'partial', 'failed']),
        timestamp: z.string().datetime(),
        duration_ms: z.number().optional()
      })),
      final_outcome: z.enum(['success', 'partial', 'failed']),
      confidence: z.number().min(0).max(1).default(0.7)
    }).strict(),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async (rawParams) => {
    try {
      const response = await client.recordBehavior({
        userId: rawParams.user_id,
        trigger: rawParams.trigger,
        context: rawParams.context,
        actions: rawParams.actions,
        finalOutcome: rawParams.final_outcome,
        confidence: rawParams.confidence
      });

      return {
        content: [{
          type: 'text',
          text: `Behavior pattern recorded successfully.\nPattern ID: ${response.data.id}\nConfidence: ${response.data.confidence}`
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

server.registerTool(
  'behavior_recall',
  {
    title: 'Recall Behavior Patterns',
    description: 'Recall relevant behavior patterns for the current task context.',
    inputSchema: z.object({
      user_id: z.string().uuid(),
      context: z.object({
        current_directory: z.string(),
        current_task: z.string(),
        project_type: z.string().optional()
      }),
      limit: z.number().int().min(1).max(10).default(5),
      similarity_threshold: z.number().min(0).max(1).default(0.7),
      response_format: z.enum(['json', 'markdown']).default('markdown')
    }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (rawParams) => {
    try {
      const response = await client.recallBehavior({
        userId: rawParams.user_id,
        context: {
          currentDirectory: rawParams.context.current_directory,
          currentTask: rawParams.context.current_task,
          projectType: rawParams.context.project_type
        },
        limit: rawParams.limit,
        similarityThreshold: rawParams.similarity_threshold
      });

      const result = response.data;
      const responseText = formatResponse(
        result,
        rawParams.response_format,
        (data) => {
          let md = `# Relevant Behavior Patterns\n\n`;
          md += `**Task:** ${rawParams.context.current_task}\n`;
          md += `**Found:** ${data.total_found} patterns\n`;
          md += `**Source:** ${response.fromCache ? 'Local Cache' : 'API'}\n\n`;

          for (const { pattern, similarity_score, relevance_reason } of data.patterns) {
            md += `## ${pattern.trigger.substring(0, 60)}...\n`;
            md += `**Similarity:** ${(similarity_score * 100).toFixed(1)}%\n`;
            md += `**Confidence:** ${(pattern.confidence * 100).toFixed(0)}%\n`;
            md += `**Used:** ${pattern.use_count} times\n\n`;
            md += `**Action Chain:**\n`;
            for (const action of pattern.actions) {
              md += `- \`${action.tool}\` → ${action.outcome}\n`;
            }
            md += `\n`;
          }

          return md;
        }
      );

      return {
        content: [{ type: 'text', text: truncateIfNeeded(responseText) }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

server.registerTool(
  'behavior_suggest',
  {
    title: 'Suggest Next Actions',
    description: 'Get AI-powered suggestions for next actions based on learned patterns.',
    inputSchema: z.object({
      user_id: z.string().uuid(),
      current_state: z.object({
        task_description: z.string(),
        completed_steps: z.array(z.string()),
        current_files: z.array(z.string()).optional()
      }),
      max_suggestions: z.number().int().min(1).max(5).default(3),
      response_format: z.enum(['json', 'markdown']).default('markdown')
    }).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async (rawParams) => {
    try {
      const response = await client.suggestBehavior({
        userId: rawParams.user_id,
        currentState: {
          taskDescription: rawParams.current_state.task_description,
          completedSteps: rawParams.current_state.completed_steps,
          currentFiles: rawParams.current_state.current_files
        },
        maxSuggestions: rawParams.max_suggestions
      });

      const result = response.data;
      const responseText = formatResponse(
        result,
        rawParams.response_format,
        (data) => {
          let md = `# Suggested Next Actions\n\n`;

          for (const suggestion of data.suggestions) {
            md += `## ${suggestion.action}\n`;
            md += `**Tool:** \`${suggestion.tool}\`\n`;
            md += `**Confidence:** ${(suggestion.confidence * 100).toFixed(0)}%\n`;
            md += `**Reasoning:** ${suggestion.reasoning}\n\n`;
          }

          return md;
        }
      );

      return {
        content: [{ type: 'text', text: truncateIfNeeded(responseText) }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);
```

### 4. Database Schema Extension (Supabase Migration)

```sql
-- Migration: Add behavior_patterns table
-- Version: 2.0.0

-- pgvector is required for VECTOR(1536) and ivfflat indexes
CREATE EXTENSION IF NOT EXISTS vector;

-- Behavior patterns table for workflow learning
CREATE TABLE IF NOT EXISTS public.behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Trigger (what initiated this workflow)
  trigger TEXT NOT NULL,
  trigger_embedding VECTOR(1536),  -- For semantic search

  -- Context
  context JSONB NOT NULL DEFAULT '{}',
  -- Expected: { directory, project_type, branch, files_touched }

  -- Action chain
  actions JSONB NOT NULL DEFAULT '[]',
  -- Expected: [{ tool, parameters, outcome, timestamp, duration_ms }]

  -- Outcome
  final_outcome TEXT NOT NULL CHECK (final_outcome IN ('success', 'partial', 'failed')),

  -- Quality metrics
  confidence FLOAT NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  use_count INT NOT NULL DEFAULT 1,
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX behavior_patterns_user_id_idx ON public.behavior_patterns(user_id);
CREATE INDEX behavior_patterns_final_outcome_idx ON public.behavior_patterns(final_outcome);
CREATE INDEX behavior_patterns_confidence_idx ON public.behavior_patterns(confidence DESC);
CREATE INDEX behavior_patterns_use_count_idx ON public.behavior_patterns(use_count DESC);

-- Vector similarity index for semantic search
CREATE INDEX behavior_patterns_embedding_idx
  ON public.behavior_patterns
  USING ivfflat (trigger_embedding vector_cosine_ops)
  WITH (lists = 100);

-- GIN index for JSONB context queries
CREATE INDEX behavior_patterns_context_idx ON public.behavior_patterns USING GIN (context);

-- RLS policies
ALTER TABLE public.behavior_patterns ENABLE ROW LEVEL SECURITY;

-- Users can only access their own patterns
CREATE POLICY "Users can view own patterns" ON public.behavior_patterns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns" ON public.behavior_patterns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns" ON public.behavior_patterns
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patterns" ON public.behavior_patterns
  FOR DELETE USING (auth.uid() = user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_behavior_pattern_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER behavior_patterns_updated_at
  BEFORE UPDATE ON public.behavior_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_behavior_pattern_timestamp();

-- Function to increment use_count on recall
CREATE OR REPLACE FUNCTION increment_pattern_use_count(pattern_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.behavior_patterns
  SET use_count = use_count + 1,
      last_used_at = NOW()
  WHERE id = pattern_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Find similar patterns by user + vector similarity (used by edge functions)
CREATE OR REPLACE FUNCTION find_similar_patterns(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  trigger text,
  trigger_embedding vector(1536),
  context jsonb,
  actions jsonb,
  final_outcome text,
  confidence float,
  use_count int,
  last_used_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bp.id,
    bp.user_id,
    bp.trigger,
    bp.trigger_embedding,
    bp.context,
    bp.actions,
    bp.final_outcome,
    bp.confidence,
    bp.use_count,
    bp.last_used_at,
    bp.created_at,
    bp.updated_at,
    (1 - (bp.trigger_embedding <=> query_embedding))::float AS similarity
  FROM public.behavior_patterns bp
  WHERE bp.user_id = p_user_id
    AND bp.trigger_embedding IS NOT NULL
    AND (1 - (bp.trigger_embedding <=> query_embedding)) >= match_threshold
  ORDER BY bp.trigger_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 5. API Routes (Edge Functions)

```typescript
// supabase/functions/intelligence-behavior-record/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { user_id, trigger, context, actions, final_outcome, confidence } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Generate embedding for trigger
  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: trigger
    })
  });

  const { data: embeddingData } = await embeddingResponse.json();
  const trigger_embedding = embeddingData[0].embedding;

  // Check for near-duplicate
  const { data: duplicates } = await supabase.rpc('find_similar_patterns', {
    query_embedding: trigger_embedding,
    match_threshold: 0.95,
    match_count: 1,
    p_user_id: user_id
  });

  if (duplicates?.length > 0) {
    // Update existing pattern
    await supabase.rpc('increment_pattern_use_count', { pattern_id: duplicates[0].id });
    return new Response(JSON.stringify({
      success: true,
      data: duplicates[0],
      message: 'Updated existing pattern'
    }));
  }

  // Insert new pattern
  const { data, error } = await supabase
    .from('behavior_patterns')
    .insert({
      user_id,
      trigger,
      trigger_embedding,
      context,
      actions,
      final_outcome,
      confidence: confidence || 0.7
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({
      success: false,
      error: { message: error.message }
    }), { status: 400 });
  }

  return new Response(JSON.stringify({
    success: true,
    data
  }));
});
```

## Version Bump

```json
{
  "name": "@lanonasis/mem-intel-sdk",
  "version": "2.0.0",
  "description": "AI-powered memory and behavior intelligence SDK for LanOnasis Memory-as-a-Service",
  "keywords": [
    "memory",
    "intelligence",
    "behavior",
    "workflow",
    "patterns",
    "ai",
    "lanonasis",
    "maas",
    "memory-as-a-service",
    "sdk"
  ]
}
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

### For MCP Server Users

```typescript
// v1.x MCP tools still work
// memory_analyze_patterns
// memory_find_related
// memory_extract_insights
// etc.

// v2.0 adds new tools
// behavior_record
// behavior_recall
// behavior_suggest
```

## Testing Plan

1. **Unit Tests** - Test each new method in isolation
2. **Integration Tests** - Test end-to-end flow
3. **Cache Tests** - Verify offline-fallback behavior
4. **Performance Tests** - Measure semantic search latency

## Release Checklist

- [ ] Add new types to `core/types.ts`
- [ ] Implement client methods in `core/client.ts`
- [ ] Register MCP tools in `server/mcp-server.ts`
- [ ] Run Supabase migration
- [ ] Deploy edge functions
- [ ] Update documentation
- [ ] Bump version to 2.0.0
- [ ] Publish to npm
