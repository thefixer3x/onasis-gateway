# SDK Upgrade Guide: mem-intel-sdk v1.x → v2.0

## Overview

This guide provides the exact code changes needed to upgrade `@lanonasis/mem-intel-sdk` to v2.0 with behavior intelligence.

## File Changes Summary

| File | Action | Lines Added |
|------|--------|-------------|
| `core/types.ts` | Extend | ~80 lines |
| `core/client.ts` | Extend | ~150 lines |
| `utils/similarity.ts` | No change | (already exists) |
| `package.json` | Update version | 1 line |

---

## 1. Type Definitions (`core/types.ts`)

Add these types after the existing type definitions:

```typescript
// =============================================================================
// BEHAVIOR INTELLIGENCE TYPES (v2.0)
// =============================================================================

/**
 * Outcome status for tool actions and workflows
 */
export type BehaviorOutcome = 'success' | 'partial' | 'failed';

/**
 * Individual tool action within a workflow
 */
export interface ToolAction {
  /** Tool name (e.g., "Read", "Edit", "Bash") */
  tool: string;
  /** Parameters passed to the tool */
  parameters: Record<string, unknown>;
  /** Outcome of the tool execution */
  outcome: BehaviorOutcome;
  /** ISO timestamp when action occurred */
  timestamp: string;
  /** Execution duration in milliseconds */
  duration_ms?: number;
}

/**
 * Stored workflow pattern for behavior learning
 */
export interface WorkflowPattern {
  id: string;
  user_id: string;
  /** What triggered this workflow (user prompt/task) */
  trigger: string;
  /** Vector embedding of trigger for semantic search */
  trigger_embedding?: number[];
  /** Context when workflow was executed */
  context: {
    directory: string;
    project_type?: string;
    branch?: string;
    files_touched?: string[];
  };
  /** Sequence of tool actions */
  actions: ToolAction[];
  /** Final outcome of the workflow */
  final_outcome: BehaviorOutcome;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Number of times this pattern was recalled/used */
  use_count: number;
  /** Last time pattern was recalled */
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Parameters for recording a behavior pattern
 */
export interface BehaviorRecordParams {
  userId: string;
  /** What triggered this workflow */
  trigger: string;
  /** Execution context */
  context: {
    directory: string;
    projectType?: string;
    branch?: string;
    filesTouched?: string[];
  };
  /** Actions performed */
  actions: ToolAction[];
  /** Final outcome */
  finalOutcome: BehaviorOutcome;
  /** Confidence score (default: 0.7) */
  confidence?: number;
}

/**
 * Parameters for recalling behavior patterns
 */
export interface BehaviorRecallParams {
  userId: string;
  /** Current context for matching */
  context: {
    currentDirectory: string;
    currentTask: string;
    projectType?: string;
  };
  /** Maximum patterns to return */
  limit?: number;
  /** Minimum similarity threshold (0.0 - 1.0) */
  similarityThreshold?: number;
}

/**
 * Parameters for behavior suggestions
 */
export interface BehaviorSuggestParams {
  userId: string;
  /** Current execution state */
  currentState: {
    taskDescription: string;
    completedSteps: string[];
    currentFiles?: string[];
  };
  /** Maximum suggestions to return */
  maxSuggestions?: number;
}

/**
 * Result from recalling behavior patterns
 */
export interface BehaviorRecallResult {
  patterns: Array<{
    pattern: WorkflowPattern;
    similarity_score: number;
    relevance_reason: string;
  }>;
  total_found: number;
}

/**
 * Individual behavior suggestion
 */
export interface BehaviorSuggestion {
  /** Suggested action description */
  action: string;
  /** Tool to use */
  tool: string;
  /** Confidence in this suggestion */
  confidence: number;
  /** Pattern IDs this is based on */
  based_on_patterns: string[];
  /** Why this is suggested */
  reasoning: string;
}

/**
 * Result from behavior suggestions
 */
export interface BehaviorSuggestResult {
  suggestions: BehaviorSuggestion[];
}
```

---

## 2. Client Methods (`core/client.ts`)

Add these methods to the `MemoryIntelligenceClient` class:

```typescript
import { cosineSimilarity } from '../utils/similarity';

// Add to MemoryIntelligenceClient class:

// =============================================================================
// BEHAVIOR INTELLIGENCE METHODS (v2.0)
// =============================================================================

/**
 * Record a successful workflow pattern for future recall
 * @param params - Recording parameters
 * @returns Stored pattern with metadata
 */
async recordBehavior(params: BehaviorRecordParams): Promise<{
  data: WorkflowPattern;
  usage?: UsageInfo;
}> {
  // Check for duplicates locally first (deduplication)
  if (this.processingMode === 'offline-fallback' && this.cache) {
    const existing = await this.findSimilarBehavior(params.trigger, params.userId);
    if (existing && existing.similarity > 0.95) {
      // Update use_count instead of creating duplicate
      return this.updateBehaviorUsage(existing.id);
    }
  }

  // Store as workflow memory via existing endpoint
  const response = await this.httpClient.postEnhanced(
    '/memories',
    {
      title: `Workflow: ${params.trigger.substring(0, 50)}`,
      content: JSON.stringify({
        trigger: params.trigger,
        actions: params.actions,
        final_outcome: params.finalOutcome,
        duration_ms: params.actions.reduce((sum, a) => sum + (a.duration_ms || 0), 0)
      }),
      type: 'workflow',
      tags: this.extractBehaviorTags(params),
      metadata: {
        confidence: params.confidence || 0.7,
        use_count: 1,
        context: {
          directory: params.context.directory,
          project_type: params.context.projectType,
          branch: params.context.branch,
          files_touched: params.context.filesTouched
        }
      }
    }
  );

  if (response.error) {
    throw new DatabaseError(`Failed to record behavior: ${response.error.message}`);
  }

  return {
    data: this.parseWorkflowPattern(response.data),
    usage: response.usage
  };
}

/**
 * Recall relevant behavior patterns for current context
 * Uses local-first approach with cached embeddings
 * @param params - Recall parameters
 * @returns Matching patterns with similarity scores
 */
async recallBehavior(params: BehaviorRecallParams): Promise<{
  data: BehaviorRecallResult;
  usage?: UsageInfo;
  fromCache?: boolean;
}> {
  // Try local cache first (local-first principle)
  if (this.processingMode === 'offline-fallback' && this.cache) {
    const cached = await this.localBehaviorSearch(params);
    if (cached.patterns.length > 0) {
      return { data: cached, fromCache: true };
    }
  }

  // Fall back to API search
  const response = await this.httpClient.postEnhanced(
    '/memories/search',
    {
      query: params.context.currentTask,
      type: 'workflow',
      threshold: params.similarityThreshold || 0.7,
      limit: params.limit || 5
    }
  );

  if (response.error) {
    throw new DatabaseError(`Failed to recall behavior: ${response.error.message}`);
  }

  // Parse and cache results
  const result = this.parseBehaviorRecallResult(response.data);

  if (this.cache && result.patterns.length > 0) {
    this.cacheBehaviorPatterns(result.patterns.map(p => p.pattern));
  }

  // Increment use_count for recalled patterns
  for (const { pattern } of result.patterns) {
    await this.incrementPatternUsage(pattern.id).catch(() => {
      // Non-critical, log but don't fail
    });
  }

  return {
    data: result,
    usage: response.usage,
    fromCache: false
  };
}

/**
 * Get AI-powered suggestions for next actions based on patterns
 * @param params - Suggestion parameters
 * @returns Suggested next actions
 */
async suggestBehavior(params: BehaviorSuggestParams): Promise<{
  data: BehaviorSuggestResult;
  usage?: UsageInfo;
}> {
  // First recall relevant patterns
  const recalled = await this.recallBehavior({
    userId: params.userId,
    context: {
      currentDirectory: '',
      currentTask: params.currentState.taskDescription,
      projectType: undefined
    },
    limit: 10,
    similarityThreshold: 0.6
  });

  // Analyze patterns to suggest next action
  const suggestions = this.analyzePatternsForSuggestions(
    recalled.data.patterns,
    params.currentState
  );

  return {
    data: { suggestions: suggestions.slice(0, params.maxSuggestions || 3) },
    usage: recalled.usage
  };
}

// =============================================================================
// PRIVATE HELPER METHODS
// =============================================================================

/**
 * Search behavior patterns locally using cached embeddings
 */
private async localBehaviorSearch(params: BehaviorRecallParams): Promise<BehaviorRecallResult> {
  const cachedPatterns: WorkflowPattern[] = this.cache?.get('behavior_patterns') || [];

  // Filter by context if specified
  const contextMatches = cachedPatterns.filter((p: WorkflowPattern) => {
    if (params.context.projectType && p.context.project_type !== params.context.projectType) {
      return false;
    }
    return true;
  });

  // Semantic search on trigger text
  const taskEmbedding = await this.getEmbedding(params.context.currentTask);

  const scored = contextMatches.map((p: WorkflowPattern) => ({
    pattern: p,
    similarity_score: p.trigger_embedding
      ? cosineSimilarity(taskEmbedding, p.trigger_embedding)
      : 0,
    relevance_reason: `Matched trigger: "${p.trigger.substring(0, 50)}..."`
  }));

  // Filter by threshold and sort by similarity
  const filtered = scored
    .filter(s => s.similarity_score >= (params.similarityThreshold || 0.7))
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, params.limit || 5);

  return {
    patterns: filtered,
    total_found: filtered.length
  };
}

/**
 * Find similar behavior pattern by trigger text
 */
private async findSimilarBehavior(trigger: string, userId: string): Promise<{ id: string; similarity: number } | null> {
  const cachedPatterns: WorkflowPattern[] = this.cache?.get('behavior_patterns') || [];
  const userPatterns = cachedPatterns.filter(p => p.user_id === userId);

  if (userPatterns.length === 0) return null;

  const triggerEmbedding = await this.getEmbedding(trigger);

  let bestMatch: { id: string; similarity: number } | null = null;

  for (const pattern of userPatterns) {
    if (!pattern.trigger_embedding) continue;

    const similarity = cosineSimilarity(triggerEmbedding, pattern.trigger_embedding);
    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { id: pattern.id, similarity };
    }
  }

  return bestMatch;
}

/**
 * Update use_count for an existing pattern
 */
private async updateBehaviorUsage(patternId: string): Promise<{
  data: WorkflowPattern;
  usage?: UsageInfo;
}> {
  const response = await this.httpClient.postEnhanced(
    `/rpc/increment_pattern_use_count`,
    { pattern_id: patternId }
  );

  if (response.error) {
    throw new DatabaseError(`Failed to update behavior usage: ${response.error.message}`);
  }

  // Fetch updated pattern
  const patternResponse = await this.httpClient.getEnhanced(`/memories/${patternId}`);

  return {
    data: this.parseWorkflowPattern(patternResponse.data),
    usage: response.usage
  };
}

/**
 * Increment use_count for a pattern
 */
private async incrementPatternUsage(patternId: string): Promise<void> {
  await this.httpClient.post(`/rpc/increment_pattern_use_count`, {
    pattern_id: patternId
  });
}

/**
 * Cache behavior patterns for local search
 */
private cacheBehaviorPatterns(patterns: WorkflowPattern[]): void {
  const existing: WorkflowPattern[] = this.cache?.get('behavior_patterns') || [];
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

/**
 * Get embedding for text (uses cache if available)
 */
private async getEmbedding(text: string): Promise<number[]> {
  const cacheKey = `embedding:${text.substring(0, 100)}`;
  const cached = this.cache?.get(cacheKey);
  if (cached) return cached;

  // Call embedding API
  const response = await this.httpClient.post('/embeddings', { text });
  const embedding = response.data?.embedding || [];

  if (this.cache && embedding.length > 0) {
    this.cache.set(cacheKey, embedding);
  }

  return embedding;
}

/**
 * Extract tags from behavior params
 */
private extractBehaviorTags(params: BehaviorRecordParams): string[] {
  const tags = ['behavior-pattern'];

  if (params.context.projectType) {
    tags.push(params.context.projectType);
  }

  // Extract tool names as tags
  const tools = [...new Set(params.actions.map(a => a.tool.toLowerCase()))];
  tags.push(...tools);

  return tags;
}

/**
 * Parse API response to WorkflowPattern
 */
private parseWorkflowPattern(data: any): WorkflowPattern {
  const content = typeof data.content === 'string'
    ? JSON.parse(data.content)
    : data.content;

  return {
    id: data.id,
    user_id: data.user_id,
    trigger: content.trigger || data.title?.replace('Workflow: ', '') || '',
    trigger_embedding: data.embedding,
    context: data.metadata?.context || {},
    actions: content.actions || [],
    final_outcome: content.final_outcome || 'success',
    confidence: data.metadata?.confidence || 0.7,
    use_count: data.metadata?.use_count || 1,
    last_used_at: data.metadata?.last_used_at,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

/**
 * Parse API response to BehaviorRecallResult
 */
private parseBehaviorRecallResult(data: any): BehaviorRecallResult {
  const results = data.results || [];

  return {
    patterns: results.map((r: any) => ({
      pattern: this.parseWorkflowPattern(r),
      similarity_score: r.similarity_score || 0,
      relevance_reason: `Matched with ${Math.round((r.similarity_score || 0) * 100)}% similarity`
    })),
    total_found: data.total || results.length
  };
}

/**
 * Analyze recalled patterns to suggest next actions
 */
private analyzePatternsForSuggestions(
  patterns: Array<{ pattern: WorkflowPattern; similarity_score: number }>,
  currentState: { taskDescription: string; completedSteps: string[]; currentFiles?: string[] }
): BehaviorSuggestion[] {
  const suggestions: BehaviorSuggestion[] = [];
  const completedCount = currentState.completedSteps.length;

  for (const { pattern, similarity_score } of patterns) {
    // Find the next action after current progress
    if (pattern.actions.length > completedCount) {
      const nextAction = pattern.actions[completedCount];

      // Check if we already have this suggestion
      const existing = suggestions.find(s => s.tool === nextAction.tool);
      if (!existing) {
        suggestions.push({
          action: `Use ${nextAction.tool}`,
          tool: nextAction.tool,
          confidence: similarity_score * pattern.confidence,
          based_on_patterns: [pattern.id],
          reasoning: `Based on similar workflow "${pattern.trigger.substring(0, 30)}..." which used ${nextAction.tool} at this step`
        });
      } else {
        // Boost confidence and add pattern reference
        existing.confidence = Math.min(1, existing.confidence + similarity_score * 0.2);
        existing.based_on_patterns.push(pattern.id);
      }
    }
  }

  // Sort by confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
```

---

## 3. Package.json Update

```json
{
  "name": "@lanonasis/mem-intel-sdk",
  "version": "2.0.0",
  "description": "AI-powered memory and behavior intelligence SDK for LanOnasis Memory-as-a-Service"
}
```

---

## Testing the SDK Changes

```typescript
import { MemoryIntelligenceClient } from '@lanonasis/mem-intel-sdk';

const client = new MemoryIntelligenceClient({
  apiKey: 'lano_xxx',
  processingMode: 'offline-fallback',
  enableCache: true
});

// Test recordBehavior
const recorded = await client.recordBehavior({
  userId: 'user-123',
  trigger: 'fix authentication bug in login flow',
  context: {
    directory: '/home/user/project',
    projectType: 'typescript-api'
  },
  actions: [
    { tool: 'Read', parameters: { file: 'auth.ts' }, outcome: 'success', timestamp: new Date().toISOString() },
    { tool: 'Edit', parameters: { file: 'auth.ts' }, outcome: 'success', timestamp: new Date().toISOString() },
    { tool: 'Bash', parameters: { command: 'npm test' }, outcome: 'success', timestamp: new Date().toISOString() }
  ],
  finalOutcome: 'success',
  confidence: 0.85
});

console.log('Recorded:', recorded.data.id);

// Test recallBehavior
const recalled = await client.recallBehavior({
  userId: 'user-123',
  context: {
    currentDirectory: '/home/user/other-project',
    currentTask: 'fix auth bug',
    projectType: 'typescript-api'
  },
  limit: 5
});

console.log('Recalled patterns:', recalled.data.total_found);
console.log('From cache:', recalled.fromCache);

// Test suggestBehavior
const suggestions = await client.suggestBehavior({
  userId: 'user-123',
  currentState: {
    taskDescription: 'fix authentication issue',
    completedSteps: ['Read auth.ts']
  },
  maxSuggestions: 3
});

console.log('Suggestions:', suggestions.data.suggestions);
```

---

## Backward Compatibility

All existing v1.x code continues to work unchanged:

```typescript
// v1.x code - still works in v2.0
const patterns = await client.analyzePatterns({ userId, timeRangeDays: 30 });
const related = await client.findRelated({ memoryId, userId });
const insights = await client.extractInsights({ userId, topic: 'deployment' });
```

## Next Steps

After implementing SDK changes:
1. Proceed to [02-mcp-server-upgrade.md](./02-mcp-server-upgrade.md) for MCP tools
2. Run the test suite to verify backward compatibility
3. Update the CHANGELOG.md with v2.0.0 release notes
