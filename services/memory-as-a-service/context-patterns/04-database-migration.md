# Database Migration Guide

## Overview

This migration adds the `behavior_patterns` table for dedicated behavior storage (optional, for v2.1+).

For MVP (v2.0), behavior patterns are stored in the existing `memories` table with `type = 'workflow'`.

---

## Option A: Use Existing Table (MVP - Recommended)

No migration needed. Behavior patterns use the existing `memories` table:

```sql
-- Existing memories table already supports:
-- - type: 'workflow' for behavior patterns
-- - content: JSON string with trigger/actions/outcome
-- - metadata: JSONB with confidence, use_count, context
-- - embedding: Vector for semantic search

-- Just ensure the 'workflow' type is indexed
CREATE INDEX IF NOT EXISTS memories_type_workflow_idx
  ON public.memories(type)
  WHERE type = 'workflow';

-- Index for frequent queries
CREATE INDEX IF NOT EXISTS memories_workflow_confidence_idx
  ON public.memories((metadata->>'confidence')::float DESC)
  WHERE type = 'workflow';
```

---

## Option B: Dedicated Table (v2.1+)

For better performance with large pattern sets, add a dedicated table:

### Migration File
```sql
-- Migration: 20260112_add_behavior_patterns.sql
-- Purpose: Add dedicated table for behavior pattern storage

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- BEHAVIOR PATTERNS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.behavior_patterns (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to user
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Trigger: what initiated this workflow
  trigger TEXT NOT NULL,
  trigger_embedding VECTOR(1536),  -- OpenAI text-embedding-3-small dimension

  -- Context: execution environment
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Expected structure:
  -- {
  --   "directory": "/path/to/project",
  --   "project_type": "typescript-api",
  --   "branch": "main",
  --   "files_touched": ["file1.ts", "file2.ts"]
  -- }

  -- Actions: sequence of tool calls
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Expected structure:
  -- [
  --   {"tool": "Read", "parameters": {...}, "outcome": "success", "timestamp": "...", "duration_ms": 100},
  --   {"tool": "Edit", "parameters": {...}, "outcome": "success", "timestamp": "...", "duration_ms": 200}
  -- ]

  -- Outcome
  final_outcome TEXT NOT NULL CHECK (final_outcome IN ('success', 'partial', 'failed')),

  -- Quality metrics
  confidence FLOAT NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  use_count INT NOT NULL DEFAULT 1 CHECK (use_count >= 0),
  last_used_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE public.behavior_patterns IS 'Stores learned workflow patterns for behavior intelligence';
COMMENT ON COLUMN public.behavior_patterns.trigger IS 'The task/prompt that initiated this workflow';
COMMENT ON COLUMN public.behavior_patterns.trigger_embedding IS 'Vector embedding for semantic search';
COMMENT ON COLUMN public.behavior_patterns.confidence IS 'Quality score (0.0-1.0) based on outcome and user feedback';
COMMENT ON COLUMN public.behavior_patterns.use_count IS 'Number of times this pattern was recalled and used';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- User lookup
CREATE INDEX behavior_patterns_user_id_idx
  ON public.behavior_patterns(user_id);

-- Outcome filter
CREATE INDEX behavior_patterns_final_outcome_idx
  ON public.behavior_patterns(final_outcome);

-- Confidence ranking
CREATE INDEX behavior_patterns_confidence_idx
  ON public.behavior_patterns(confidence DESC);

-- Usage frequency
CREATE INDEX behavior_patterns_use_count_idx
  ON public.behavior_patterns(use_count DESC);

-- Vector similarity search (IVFFlat index)
-- Tune 'lists' based on dataset size:
--   - Small (<10k): lists = 50
--   - Medium (10k-100k): lists = 100
--   - Large (>100k): lists = 200-500
CREATE INDEX behavior_patterns_embedding_idx
  ON public.behavior_patterns
  USING ivfflat (trigger_embedding vector_cosine_ops)
  WITH (lists = 100);

-- GIN index for JSONB context queries
CREATE INDEX behavior_patterns_context_idx
  ON public.behavior_patterns
  USING GIN (context);

-- GIN index for JSONB actions queries
CREATE INDEX behavior_patterns_actions_idx
  ON public.behavior_patterns
  USING GIN (actions);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.behavior_patterns ENABLE ROW LEVEL SECURITY;

-- Users can only access their own patterns
CREATE POLICY "Users can view own patterns"
  ON public.behavior_patterns
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns"
  ON public.behavior_patterns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns"
  ON public.behavior_patterns
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patterns"
  ON public.behavior_patterns
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can access all (for admin/analytics)
CREATE POLICY "Service role full access"
  ON public.behavior_patterns
  FOR ALL
  TO service_role
  USING (true);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Auto-update updated_at timestamp
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

-- Increment use_count (for recall tracking)
CREATE OR REPLACE FUNCTION increment_pattern_use_count(pattern_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.behavior_patterns
  SET
    use_count = use_count + 1,
    last_used_at = NOW()
  WHERE id = pattern_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Find similar patterns using vector similarity
CREATE OR REPLACE FUNCTION find_similar_patterns(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  trigger TEXT,
  context JSONB,
  actions JSONB,
  final_outcome TEXT,
  confidence FLOAT,
  use_count INT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bp.id,
    bp.trigger,
    bp.context,
    bp.actions,
    bp.final_outcome,
    bp.confidence,
    bp.use_count,
    1 - (bp.trigger_embedding <=> query_embedding) AS similarity
  FROM public.behavior_patterns bp
  WHERE
    (p_user_id IS NULL OR bp.user_id = p_user_id)
    AND bp.trigger_embedding IS NOT NULL
    AND 1 - (bp.trigger_embedding <=> query_embedding) >= match_threshold
  ORDER BY bp.trigger_embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- GRANTS
-- =============================================================================

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.behavior_patterns TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION increment_pattern_use_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_patterns(VECTOR(1536), FLOAT, INT, UUID) TO authenticated;
```

---

## Running the Migration

### Supabase CLI
```bash
# Create migration file
supabase migration new add_behavior_patterns

# Paste the SQL into the generated file
# Then push to database
supabase db push
```

### Direct SQL
```bash
# Connect to database and run
psql $DATABASE_URL -f migrations/20260112_add_behavior_patterns.sql
```

---

## Verification

```sql
-- Check table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'behavior_patterns'
);

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'behavior_patterns';

-- Check RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'behavior_patterns';

-- Test insert
INSERT INTO public.behavior_patterns (user_id, trigger, context, actions, final_outcome)
VALUES (
  auth.uid(),
  'Test workflow trigger',
  '{"directory": "/test"}',
  '[{"tool": "Read", "outcome": "success"}]',
  'success'
);

-- Test similarity search
SELECT * FROM find_similar_patterns(
  '[0.1, 0.2, ...]'::vector(1536),  -- Your embedding
  0.7,                               -- Threshold
  5,                                 -- Limit
  auth.uid()                         -- User filter
);
```

---

## Rollback

```sql
-- Remove everything added by this migration
DROP FUNCTION IF EXISTS find_similar_patterns CASCADE;
DROP FUNCTION IF EXISTS increment_pattern_use_count CASCADE;
DROP TRIGGER IF EXISTS behavior_patterns_updated_at ON public.behavior_patterns;
DROP FUNCTION IF EXISTS update_behavior_pattern_timestamp CASCADE;
DROP TABLE IF EXISTS public.behavior_patterns CASCADE;
```

---

## Next Steps

1. Proceed to [05-edge-functions.md](./05-edge-functions.md) for edge function implementation
2. Or return to SDK implementation with the schema ready
