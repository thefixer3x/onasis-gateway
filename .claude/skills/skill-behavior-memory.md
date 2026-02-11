# Skill: Behavior Memory Integration

## Purpose & Scope

This skill teaches AI agents to leverage `@lanonasis/mem-intel-sdk` for **behavioral pattern learning** - recording successful workflows and recalling them in future sessions.

**Key Principle**: Local-first processing with cached embeddings. API calls are fallback, not primary.

## API Reference

Base URL: `https://api.lanonasis.com/api/v1`

| Operation | Endpoint | Method | Description |
|-----------|----------|--------|-------------|
| Store pattern | `/memories` | POST | Create with `type: workflow` |
| Recall patterns | `/memories/search` | POST | Semantic search with `type: workflow` |
| List patterns | `/memories?type=workflow` | GET | Filter by workflow type |
| Update pattern | `/memories/{id}` | PUT | Update use_count in metadata |
| Delete pattern | `/memories/{id}` | DELETE | Remove stale patterns |
| Analyze patterns | `/intelligence/analyze-patterns` | POST | mem-intel-sdk |
| Find related | `/intelligence/find-related` | POST | mem-intel-sdk |
| Extract insights | `/intelligence/extract-insights` | POST | mem-intel-sdk |

### Authentication (3 methods)
```
OAuth2 PKCE (Primary): Authorization header with token
API Key (Fallback):    X-API-Key: lano_*
JWT (Legacy):          Authorization: Bearer <jwt>
```

### MemoryType Enum
```typescript
type MemoryType = 'context' | 'project' | 'knowledge' | 'reference' | 'personal' | 'workflow';
//                                                                                  ^^^^^^^^
//                                                                      Use this for behavior patterns
```

### API Payload Examples

**Record Pattern (POST /memories)**
```json
{
  "title": "Workflow: Fix authentication bug in TypeScript API",
  "content": "{\"trigger\":\"fix auth bug\",\"actions\":[{\"tool\":\"Read\",\"outcome\":\"success\"},{\"tool\":\"Edit\",\"outcome\":\"success\"},{\"tool\":\"Bash\",\"outcome\":\"success\"}],\"final_outcome\":\"success\",\"duration_ms\":45000}",
  "type": "workflow",
  "tags": ["auth", "bugfix", "typescript-api"],
  "metadata": {
    "confidence": 0.85,
    "use_count": 1,
    "context": {
      "directory": "/home/user/onasis-gateway",
      "project_type": "typescript-api",
      "branch": "main"
    }
  }
}
```

**Recall Patterns (POST /memories/search)**
```json
{
  "query": "fix authentication bug in typescript",
  "type": "workflow",
  "threshold": 0.7,
  "limit": 5
}
```

**Response Structure**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "uuid",
        "title": "Workflow: Fix auth bug",
        "content": "...",
        "type": "workflow",
        "similarity_score": 0.89,
        "metadata": { "confidence": 0.85, "use_count": 3 }
      }
    ],
    "total": 1
  }
}
```

## Architecture Understanding

```
┌─────────────────────────────────────────────────────────────────┐
│                 BEHAVIOR MEMORY FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SESSION START                                                  │
│  ┌─────────────────┐                                           │
│  │ 1. Recall       │──► Query cached patterns for context      │
│  │    Patterns     │──► Semantic match: current task → history │
│  └─────────────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ 2. Inject       │──► Enrich agent context with patterns     │
│  │    Context      │──► "User typically does X when Y"         │
│  └─────────────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  SESSION EXECUTION                                              │
│  ┌─────────────────┐                                           │
│  │ 3. Agent        │──► Execute with pattern-informed behavior │
│  │    Actions      │──► Track tools used, outcomes             │
│  └─────────────────┘                                           │
│           │                                                     │
│           ▼                                                     │
│  SESSION END                                                    │
│  ┌─────────────────┐                                           │
│  │ 4. Record       │──► Store: trigger → actions → outcome     │
│  │    Pattern      │──► Generate embedding for future recall   │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Memory Types for Behavior Patterns

Use the correct `MemoryType` when storing behavior patterns:

| Memory Type | Use For |
|-------------|---------|
| `workflow` | Multi-step action sequences |
| `context` | Session context (directory, project type) |
| `project` | Project-specific patterns |
| `knowledge` | Learned preferences and rules |
| `personal` | User-specific behavior preferences |

## MCP Tools Available

### Analysis Tools (Read-Only)

```typescript
// Analyze user's behavior patterns over time
memory_analyze_patterns({
  user_id: "uuid",
  time_range_days: 30,
  response_format: "markdown"
})
// Returns: peak hours, memory types distribution, trends

// Find related memories using vector similarity
memory_find_related({
  memory_id: "uuid",
  user_id: "uuid",
  limit: 10,
  similarity_threshold: 0.7
})
// Returns: semantically similar memories

// Extract insights from memories
memory_extract_insights({
  user_id: "uuid",
  topic: "deployment",        // Optional filter
  memory_type: "workflow",    // Optional filter
  max_memories: 20
})
// Returns: patterns, learnings, opportunities, risks
```

### Suggestion Tools

```typescript
// Get AI-powered tag suggestions
memory_suggest_tags({
  memory_id: "uuid",
  user_id: "uuid",
  max_suggestions: 5
})
// Returns: suggested tags with confidence scores

// Detect duplicate memories
memory_detect_duplicates({
  user_id: "uuid",
  similarity_threshold: 0.9
})
// Returns: duplicate pairs with recommendations
```

### Health Monitoring

```typescript
// Check memory organization quality
memory_health_check({
  user_id: "uuid"
})
// Returns: health score, metrics, issues, recommendations
```

## Session Integration Patterns

### Pattern 1: Session Start - Recall & Inject

```javascript
// On session start, recall relevant patterns
async function onSessionStart(context) {
  const client = new MemoryIntelligenceClient({
    apiKey: process.env.LANONASIS_API_KEY,
    processingMode: 'offline-fallback',  // Local-first!
    enableCache: true
  });

  // Extract insights relevant to current task
  const insights = await client.extractInsights({
    userId: context.userId,
    topic: context.currentTask,
    memoryType: 'workflow',
    maxMemories: 10
  });

  // Inject into agent context
  return {
    systemPromptAddition: `
## User Behavior Patterns
${insights.data.summary}

## Relevant Past Actions
${insights.data.insights
  .filter(i => i.category === 'pattern')
  .map(i => `- ${i.title}: ${i.description}`)
  .join('\n')}
`
  };
}
```

### Pattern 2: Session End - Record Successful Pattern

```javascript
// On successful session end, record the pattern
async function onSessionEnd(context, outcome) {
  if (outcome.status !== 'success') return;

  const client = new MemoryIntelligenceClient({
    apiKey: process.env.LANONASIS_API_KEY
  });

  // Store as workflow memory for future recall
  await client.httpClient.post('/memories', {
    user_id: context.userId,
    title: `Workflow: ${context.taskSummary}`,
    content: JSON.stringify({
      trigger: context.initialPrompt,
      actions: context.toolsUsed,
      outcome: outcome.result,
      duration: outcome.duration
    }),
    type: 'workflow',
    tags: extractTags(context),
    metadata: {
      directory: context.workingDirectory,
      project_type: context.projectType,
      confidence: outcome.userSatisfaction || 0.7
    }
  });
}
```

### Pattern 3: Real-Time Pattern Matching

```javascript
// During execution, match current action to past patterns
async function matchPattern(currentAction) {
  const client = new MemoryIntelligenceClient({
    apiKey: process.env.LANONASIS_API_KEY,
    processingMode: 'offline-fallback'
  });

  // Find related workflows
  const related = await client.findRelated({
    memoryId: currentAction.contextMemoryId,
    userId: currentAction.userId,
    limit: 5,
    similarityThreshold: 0.75
  });

  // Return matching patterns for guidance
  return related.data.related_memories.map(m => ({
    pattern: JSON.parse(m.content_preview),
    similarity: m.similarity_score
  }));
}
```

## Critical Rules - NEVER Do

### Data Privacy
- **NEVER** store PII in behavior patterns
- **NEVER** record authentication tokens or secrets
- **NEVER** log sensitive file contents in patterns
- **NEVER** share patterns across user boundaries

### Pattern Quality
- **NEVER** record failed sessions as successful patterns
- **NEVER** store patterns with confidence < 0.5
- **NEVER** record incomplete workflows
- **NEVER** overwrite high-confidence patterns with lower ones

### Performance
- **NEVER** call API when cache is fresh and relevant
- **NEVER** skip `processingMode: 'offline-fallback'` for recall operations
- **NEVER** generate embeddings client-side when API can do it
- **NEVER** store duplicate patterns (use `detectDuplicates` first)

## Required Patterns - MUST Follow

### Memory Storage
```javascript
// MUST include these fields for workflow memories
{
  type: 'workflow',           // Required for behavior patterns
  tags: [...],                // Required for filtering
  metadata: {
    confidence: 0.0-1.0,      // Required for ranking
    directory: string,        // Required for context matching
    project_type: string      // Required for project filtering
  }
}
```

### Pattern Recall
```javascript
// MUST use offline-fallback for recall operations
const client = new MemoryIntelligenceClient({
  processingMode: 'offline-fallback',
  enableCache: true,
  cacheTTL: 300000  // 5 minutes
});
```

### Confidence Scoring
```javascript
// MUST calculate confidence based on outcome
function calculateConfidence(outcome) {
  let confidence = 0.5;  // Base

  if (outcome.userExplicitApproval) confidence += 0.3;
  if (outcome.noErrors) confidence += 0.1;
  if (outcome.completedAllSteps) confidence += 0.1;

  return Math.min(confidence, 1.0);
}
```

## Integration with Other Skills

| Skill | Integration Point |
|-------|-------------------|
| `skill-base-client.md` | Record API call patterns |
| `skill-compliance-manager.md` | Filter sensitive data before storage |
| `skill-metrics-collector.md` | Track pattern usage metrics |
| `skill-version-manager.md` | Version-tag workflow patterns |

## Hook Integration

### Claude Code Session Hooks

```javascript
// .claude/hooks/behavior-memory.js
module.exports = {
  // Pre-session: Inject relevant patterns
  'session:start': async (ctx) => {
    const patterns = await recallPatterns(ctx);
    return { inject: formatPatternsForContext(patterns) };
  },

  // Post-tool: Track tool usage
  'tool:complete': async (ctx, tool, result) => {
    trackToolUsage(ctx.sessionId, tool, result);
  },

  // Post-session: Store successful patterns
  'session:end': async (ctx, outcome) => {
    if (outcome.success) {
      await storePattern(ctx, outcome);
    }
  }
};
```

## Workflow Memory Schema

```typescript
interface WorkflowMemory {
  // Standard fields
  id: string;
  user_id: string;
  title: string;           // "Workflow: [task summary]"
  content: string;         // JSON stringified WorkflowContent
  type: 'workflow';
  tags: string[];

  // Metadata
  metadata: {
    confidence: number;    // 0.0 - 1.0
    directory: string;     // Working directory
    project_type: string;  // e.g., "typescript-api"
    use_count: number;     // Times this pattern was recalled
    last_used: string;     // ISO timestamp
  };

  // Auto-generated
  embedding?: number[];    // Vector for semantic search
  created_at: string;
  updated_at: string;
}

interface WorkflowContent {
  trigger: string;         // What initiated this workflow
  actions: ToolAction[];   // Sequence of tool calls
  outcome: string;         // Final result summary
  duration_ms: number;     // How long it took
}

interface ToolAction {
  tool: string;            // Tool name
  parameters: object;      // Parameters used
  outcome: 'success' | 'partial' | 'failed';
  timestamp: string;
}
```

## Testing Behavior Memory

```bash
# 1. Test pattern analysis
curl -s -X POST "https://api.lanonasis.com/api/v1/intelligence/analyze-patterns" \
  -H "X-API-Key: lano_xxx" \
  -H "Content-Type: application/json" \
  -d '{"userId": "uuid", "timeRangeDays": 30}'

# 2. Test insight extraction for workflows
curl -s -X POST "https://api.lanonasis.com/api/v1/intelligence/extract-insights" \
  -H "X-API-Key: lano_xxx" \
  -H "Content-Type: application/json" \
  -d '{"userId": "uuid", "memoryType": "workflow", "maxMemories": 10}'

# 3. Test related memory search
curl -s -X POST "https://api.lanonasis.com/api/v1/intelligence/find-related" \
  -H "X-API-Key: lano_xxx" \
  -H "Content-Type: application/json" \
  -d '{"memoryId": "uuid", "userId": "uuid", "similarityThreshold": 0.7}'
```

## Rollback Procedure

If behavior patterns cause issues:

1. **Clear cache**
   ```javascript
   client.clearCache();
   ```

2. **Switch to API-only mode**
   ```javascript
   const client = new MemoryIntelligenceClient({
     processingMode: 'api'  // Bypass local cache
   });
   ```

3. **Delete problematic patterns**
   ```javascript
   await client.httpClient.delete(`/memories/${memoryId}`);
   ```

4. **Reset to clean state**
   ```javascript
   // Get all workflow memories
   const workflows = await client.queryMemories(userId, { type: 'workflow' });

   // Delete patterns with low confidence
   for (const w of workflows.filter(w => w.metadata.confidence < 0.5)) {
     await client.httpClient.delete(`/memories/${w.id}`);
   }
   ```

## Evolution Roadmap

The `@lanonasis/mem-intel-sdk` v2.0 should add these tools:

| Tool | Purpose | Priority |
|------|---------|----------|
| `behavior_record` | Store workflow patterns | High |
| `behavior_recall` | Query patterns for context | High |
| `behavior_suggest` | Predict next actions | Medium |
| `behavior_prune` | Remove stale patterns | Low |

These will complement the existing analysis tools to complete the behavior learning cycle.
---
name: behavior-memory-integration
description: Guidance for behavior pattern capture, recall, and suggestion using the Lanonasis Enterprise MCP server. Use when implementing workflow memory, behavior tools, memory analytics, or integrating behavior patterns with MCP memory and intelligence tools.
---

# Skill: Behavior Memory Integration

## Purpose & Scope
This skill guides agents to use Enterprise MCP behavior tools to capture successful workflows, recall relevant patterns at session start, and suggest next actions during execution. It aligns behavior storage with MCP memory and intelligence tooling for consistent, reusable operations.

## Core Tools
- `behavior_record` to store successful workflow patterns.
- `behavior_recall` to retrieve relevant patterns before a task.
- `behavior_suggest` to recommend next actions mid-task.
- `create_memory`, `search_memories`, `update_memory`, `list_memories` for workflow memory storage and discovery.
- `intelligence_*` tools for pattern analysis, duplicates, related memories, and insights.

## Memory Types for Behavior Patterns
- Use `workflow` for multi-step action sequences.
- Use `context` for session context such as directories and task scope.
- Use `project` for project-specific patterns.
- Use `knowledge` for generalized rules or preferences.
- Use `personal` for user-specific behavior preferences.

## Session Integration Patterns

### Session Start
- Call `behavior_recall` with current task context.
- Inject returned patterns into the system or tool context.

Example input:
```json
{
  "user_id": "uuid",
  "context": {
    "current_directory": "/path/to/project",
    "current_task": "Improve tag hygiene",
    "project_type": "node"
  },
  "limit": 5,
  "similarity_threshold": 0.7
}
```

### Session Execution
- Use `behavior_suggest` when the next steps are unclear.

Example input:
```json
{
  "user_id": "uuid",
  "current_state": {
    "task_description": "Add tags to new memories",
    "completed_steps": ["search_memories for related context"],
    "current_files": ["/path/to/notes.md"]
  },
  "max_suggestions": 3
}
```

### Session End
- Record successful workflows with `behavior_record`.

Example input:
```json
{
  "user_id": "uuid",
  "trigger": "User asked to summarize memory trends",
  "context": {
    "directory": "/path/to/project",
    "project_type": "node",
    "branch": "main",
    "files_touched": ["src/index.ts"]
  },
  "actions": [
    {
      "tool": "intelligence_analyze_patterns",
      "parameters": {"time_range_days": 30},
      "outcome": "Returned pattern analysis",
      "timestamp": "2026-02-06T12:00:00Z"
    }
  ],
  "final_outcome": "success",
  "confidence": 0.8
}
```

## Intelligence and Analytics
Use intelligence tools to improve behavior and memory quality.
- `intelligence_analyze_patterns` for usage trends.
- `intelligence_find_related` for semantic similarity.
- `intelligence_detect_duplicates` for cleanup.
- `intelligence_extract_insights` for themes and action items.
- `intelligence_health_check` for organization health.

## Prompts and Resources
- `memory_workflow` prompt for create, search, organize, and analyze flows.
- `api_key_management` prompt for key hygiene.
- `intelligence_guide` prompt for intelligence tool overviews.
- `mcp://tools/reference` for full tool parameters.
- `mcp://troubleshooting/guide` for sanitization rules and errors.

## Sanitization Notes
- Avoid CLI flag examples, backticks, or shell command syntax in stored content.
- Prefer descriptive text or chunk large content with `create_memory_chunked`.

## Templates and Automation
- Reuse JSON templates from the Enterprise MCP Memory skill at `/Users/seyederick/.codex/skills/enterprise-mcp-memory/assets/workflow-templates/`.
- Use `/Users/seyederick/.codex/skills/enterprise-mcp-memory/scripts/generate_template_from_prompt.py` to generate tailored templates from natural language prompts.

## Gap Handling
If a behavior cleanup tool is needed, use `search_memories` with `type: workflow` and `delete_memory` to remove stale patterns.
