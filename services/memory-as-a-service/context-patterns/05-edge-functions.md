# Edge Functions Guide

## Overview

These Supabase Edge Functions provide the server-side logic for behavior intelligence operations.

---

## Function: `intelligence-behavior-record`

Records a behavior pattern with embedding generation and deduplication.

### File: `supabase/functions/intelligence-behavior-record/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const embeddingModel = Deno.env.get('EMBEDDING_MODEL') || 'text-embedding-3-small';

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Server configuration error', code: 'CONFIG_ERROR' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Embedding service not configured', code: 'EMBEDDING_ERROR' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { user_id, trigger, context, actions, final_outcome, confidence = 0.7 } = await req.json();

    // Validate required fields
    if (!user_id || !trigger || !actions || !final_outcome) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Missing required fields', code: 'VALIDATION_ERROR' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate embedding for trigger
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: trigger,
      }),
    });

    if (!embeddingResponse.ok) {
      const errText = await embeddingResponse.text();
      console.error('Embedding API error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Failed to generate embedding', code: 'EMBEDDING_ERROR' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const embeddingData = await embeddingResponse.json();
    const triggerEmbedding = embeddingData.data[0].embedding;

    // Check for near-duplicate using vector similarity
    const { data: duplicates, error: dupError } = await supabase.rpc('find_similar_patterns', {
      query_embedding: triggerEmbedding,
      match_threshold: 0.95,  // High threshold for dedup
      match_count: 1,
      p_user_id: user_id,
    });

    if (dupError) {
      console.error('Duplicate check error:', dupError);
      // Continue without dedup check
    }

    // If duplicate found, update use_count instead of creating new
    if (duplicates && duplicates.length > 0) {
      const existingId = duplicates[0].id;

      const { error: updateError } = await supabase.rpc('increment_pattern_use_count', {
        pattern_id: existingId,
      });

      if (updateError) {
        console.error('Update error:', updateError);
      }

      // Fetch updated pattern
      const { data: updated } = await supabase
        .from('behavior_patterns')
        .select('*')
        .eq('id', existingId)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          data: updated,
          message: 'Updated existing pattern (duplicate detected)',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert new pattern
    const { data, error } = await supabase
      .from('behavior_patterns')
      .insert({
        user_id,
        trigger,
        trigger_embedding: triggerEmbedding,
        context: context || {},
        actions: actions || [],
        final_outcome,
        confidence,
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return new Response(
        JSON.stringify({ success: false, error: { message: error.message, code: 'DB_ERROR' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Function: `intelligence-behavior-recall`

Recalls relevant patterns using vector similarity search.

### File: `supabase/functions/intelligence-behavior-recall/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const embeddingModel = Deno.env.get('EMBEDDING_MODEL') || 'text-embedding-3-small';

    if (!supabaseUrl || !supabaseKey || !openaiKey) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Server configuration error', code: 'CONFIG_ERROR' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, context, limit = 5, similarity_threshold = 0.7 } = await req.json();

    if (!user_id || !context?.current_task) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Missing required fields', code: 'VALIDATION_ERROR' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate embedding for current task
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: context.current_task,
      }),
    });

    if (!embeddingResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Failed to generate embedding', code: 'EMBEDDING_ERROR' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const embeddingData = await embeddingResponse.json();
    const taskEmbedding = embeddingData.data[0].embedding;

    // Find similar patterns
    const { data: patterns, error } = await supabase.rpc('find_similar_patterns', {
      query_embedding: taskEmbedding,
      match_threshold: similarity_threshold,
      match_count: limit,
      p_user_id: user_id,
    });

    if (error) {
      console.error('Search error:', error);
      return new Response(
        JSON.stringify({ success: false, error: { message: error.message, code: 'DB_ERROR' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment use_count for recalled patterns
    for (const pattern of patterns || []) {
      await supabase.rpc('increment_pattern_use_count', { pattern_id: pattern.id }).catch(() => {});
    }

    // Format response
    const result = {
      patterns: (patterns || []).map((p: any) => ({
        pattern: {
          id: p.id,
          trigger: p.trigger,
          context: p.context,
          actions: p.actions,
          final_outcome: p.final_outcome,
          confidence: p.confidence,
          use_count: p.use_count,
        },
        similarity_score: p.similarity,
        relevance_reason: `Matched with ${Math.round(p.similarity * 100)}% similarity`,
      })),
      total_found: patterns?.length || 0,
    };

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Function: `intelligence-behavior-suggest`

Generates action suggestions based on recalled patterns.

### File: `supabase/functions/intelligence-behavior-suggest/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const embeddingModel = Deno.env.get('EMBEDDING_MODEL') || 'text-embedding-3-small';

    if (!supabaseUrl || !supabaseKey || !openaiKey) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Server configuration error', code: 'CONFIG_ERROR' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, current_state, max_suggestions = 3 } = await req.json();

    if (!user_id || !current_state?.task_description) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Missing required fields', code: 'VALIDATION_ERROR' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate embedding for task description
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: current_state.task_description,
      }),
    });

    if (!embeddingResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Failed to generate embedding', code: 'EMBEDDING_ERROR' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const embeddingData = await embeddingResponse.json();
    const taskEmbedding = embeddingData.data[0].embedding;

    // Find similar patterns (with lower threshold for suggestions)
    const { data: patterns, error } = await supabase.rpc('find_similar_patterns', {
      query_embedding: taskEmbedding,
      match_threshold: 0.6,  // Lower threshold for broader suggestions
      match_count: 10,
      p_user_id: user_id,
    });

    if (error) {
      console.error('Search error:', error);
      return new Response(
        JSON.stringify({ success: false, error: { message: error.message, code: 'DB_ERROR' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze patterns to generate suggestions
    const completedCount = current_state.completed_steps?.length || 0;
    const suggestions: any[] = [];

    for (const pattern of patterns || []) {
      const actions = pattern.actions || [];

      // Find the next action after current progress
      if (actions.length > completedCount) {
        const nextAction = actions[completedCount];

        // Check if we already have this suggestion
        const existing = suggestions.find(s => s.tool === nextAction.tool);

        if (!existing) {
          suggestions.push({
            action: `Use ${nextAction.tool}`,
            tool: nextAction.tool,
            confidence: pattern.similarity * pattern.confidence,
            based_on_patterns: [pattern.id],
            reasoning: `Based on similar workflow "${pattern.trigger.substring(0, 30)}..." which used ${nextAction.tool} at this step`,
          });
        } else {
          // Boost confidence and add pattern reference
          existing.confidence = Math.min(1, existing.confidence + pattern.similarity * 0.2);
          existing.based_on_patterns.push(pattern.id);
        }
      }
    }

    // Sort by confidence and limit
    const topSuggestions = suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, max_suggestions);

    return new Response(
      JSON.stringify({ success: true, data: { suggestions: topSuggestions } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Deployment

### Deploy All Functions
```bash
# Deploy behavior-record
supabase functions deploy intelligence-behavior-record

# Deploy behavior-recall
supabase functions deploy intelligence-behavior-recall

# Deploy behavior-suggest
supabase functions deploy intelligence-behavior-suggest
```

### Set Environment Variables
```bash
# Required for all functions
supabase secrets set OPENAI_API_KEY=sk-xxx

# Optional (has default)
supabase secrets set EMBEDDING_MODEL=text-embedding-3-small
```

---

## Testing

### Test Record
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/intelligence-behavior-record" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "YOUR_USER_ID",
    "trigger": "Fix authentication bug",
    "context": {"directory": "/project"},
    "actions": [{"tool": "Read", "outcome": "success"}],
    "final_outcome": "success"
  }'
```

### Test Recall
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/intelligence-behavior-recall" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "YOUR_USER_ID",
    "context": {"current_task": "Fix auth bug"},
    "limit": 5
  }'
```

### Test Suggest
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/intelligence-behavior-suggest" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "YOUR_USER_ID",
    "current_state": {
      "task_description": "Fix authentication",
      "completed_steps": ["Read auth.ts"]
    }
  }'
```

---

## Monitoring

```sql
-- Check function logs in Supabase dashboard
-- Or query the logs table if available

-- Monitor pattern creation rate
SELECT
  date_trunc('day', created_at) AS day,
  COUNT(*) AS patterns_created
FROM behavior_patterns
GROUP BY day
ORDER BY day DESC
LIMIT 7;

-- Monitor recall frequency
SELECT
  date_trunc('day', last_used_at) AS day,
  SUM(use_count) AS total_recalls
FROM behavior_patterns
WHERE last_used_at IS NOT NULL
GROUP BY day
ORDER BY day DESC
LIMIT 7;
```

---

## Implementation Complete

You now have all the pieces for behavior intelligence:

1. **SDK** (`01-sdk-upgrade-guide.md`) - Client-side methods
2. **MCP Server** (`02-mcp-server-upgrade.md`) - Tool registration
3. **REST API** (`03-rest-api-upgrade.md`) - Endpoint integration
4. **Database** (`04-database-migration.md`) - Schema and functions
5. **Edge Functions** (this file) - Server-side logic

Return to [README.md](./README.md) for the implementation checklist.
