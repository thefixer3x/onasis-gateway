---
name: behavior-memory
description: Use this skill when recording, recalling, or analyzing behavioral workflow patterns via the LanOnasis MaaS API. Trigger when the user or an agent wants to save a successful workflow for future reuse, recall past patterns before starting a task, analyze how Claude has handled similar tasks before, or when working with the `@lanonasis/mem-intel-sdk` behavior features. Also trigger when the user says things like "remember how I did this", "what's my usual pattern for X", "log this workflow", or "use my previous approach."
---

# Skill: Behavior Memory Integration

## Purpose

Teach agents to **record successful workflows** and **recall them in future sessions** using the LanOnasis MaaS API — so Claude learns from real execution history instead of starting from scratch every time.

**Local-first**: Use cached embeddings for recall. API is fallback, not primary.

---

## API Quick Reference

**Base URL**: `https://api.lanonasis.com/api/v1`

| Operation | Endpoint | Method |
|-----------|----------|--------|
| Record pattern | `/memories` | POST |
| Recall patterns | `/memories/search` | POST |
| List patterns | `/memories?type=workflow` | GET |
| Update pattern | `/memories/{id}` | PUT |
| Delete pattern | `/memories/{id}` | DELETE |
| Analyze patterns | `/intelligence/analyze-patterns` | POST |
| Find related | `/intelligence/find-related` | POST |
| Extract insights | `/intelligence/extract-insights` | POST |

### Authentication
```
Primary:  Authorization: Bearer <oauth2_pkce_token>
Fallback: X-API-Key: lano_*
Legacy:   Authorization: Bearer <jwt>
```

---

## Session Flow

```
SESSION START
  └─ 1. Recall: semantic search for patterns matching current task
  └─ 2. Inject: enrich agent context — "User usually does X when Y"

SESSION EXECUTION
  └─ 3. Act: execute with pattern-informed behavior, track tool outcomes

SESSION END
  └─ 4. Record: store trigger → actions → outcome as workflow memory
```

---

## Recording a Pattern

```json
POST /memories
{
  "title": "Workflow: Fix auth bug in TypeScript API",
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

### Confidence Formula
```javascript
function calculateConfidence(outcome) {
  let score = 0.5;                              // base
  if (outcome.userExplicitApproval) score += 0.3;
  if (outcome.noErrors)             score += 0.1;
  if (outcome.completedAllSteps)    score += 0.1;
  return Math.min(score, 1.0);
}
```

**Only record patterns with confidence ≥ 0.5. Never record failed workflows.**

---

## Recalling Patterns

```json
POST /memories/search
{
  "query": "fix authentication bug in typescript",
  "type": "workflow",
  "threshold": 0.7,
  "limit": 5
}
```

### Client Configuration (always use offline-fallback for recall)
```javascript
const client = new MemoryIntelligenceClient({
  processingMode: 'offline-fallback',
  enableCache: true,
  cacheTTL: 300000  // 5 minutes
});
```

---

## MCP Tools

### Analysis (Read-Only)
```typescript
// Analyze patterns over time
memory_analyze_patterns({ user_id, time_range_days: 30, response_format: "markdown" })

// Find related memories by vector similarity
memory_find_related({ memory_id, user_id, limit: 10, similarity_threshold: 0.7 })

// Extract themes and insights
memory_extract_insights({ user_id, topic: "deployment", memory_type: "workflow", max_memories: 20 })
```

### Behavior Write Tools (v2.0)
```typescript
// Record a successful workflow pattern
behavior_record({
  user_id,
  trigger: "fix auth bug",
  context: { directory: "/apps/mcp-core", project_type: "typescript-api", branch: "main" },
  actions: [{ tool: "Read", outcome: "success" }, { tool: "Edit", outcome: "success" }],
  final_outcome: "success",
  confidence: 0.85
})

// Recall relevant patterns for current context
behavior_recall({
  user_id,
  context: { currentDirectory: "/apps/mcp-core", currentTask: "fix auth middleware", projectType: "typescript-api" },
  limit: 5,
  similarityThreshold: 0.7
})

// Get AI-powered next-action suggestions
behavior_suggest({ user_id, current_state: { task, context, history } })
```

---

## Memory Types

| Type | Use For |
|------|---------|
| `workflow` | Multi-step action sequences ← **primary for behavior patterns** |
| `context` | Session context (directory, project type) |
| `project` | Project-specific patterns |
| `knowledge` | Learned preferences and rules |
| `personal` | User-specific behavior preferences |

---

## Failure Modes & Recovery

| Failure | Recovery |
|---------|----------|
| API unreachable | Use `processingMode: 'offline-fallback'` — serve from local cache |
| Cache miss + API down | Proceed without pattern context; log the miss |
| Auth error (401) | Try `X-API-Key` header fallback; if both fail, skip pattern recording |
| Confidence < 0.5 | Do not record; log reason |
| Duplicate detected (similarity > 0.95) | Update `use_count` on existing record instead of creating new |

---

## Hard Rules

- **Never** store PII, tokens, or secrets in patterns
- **Never** record failed sessions as successful patterns
- **Never** call API when cache is fresh and relevant
- **Never** create duplicates — check first with `detectDuplicates`
- **Never** overwrite a high-confidence pattern with a lower-confidence one
