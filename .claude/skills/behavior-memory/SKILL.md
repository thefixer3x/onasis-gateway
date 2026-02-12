---
name: behavior-memory
description: "Guidance for using @lanonasis/mem-intel-sdk to store and recall workflow memory. Use when implementing behavior pattern capture, search, or mem-intel auth flows."
---

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

## Architecture Understanding

```
+------------------------------------------------------------------+
|                 BEHAVIOR MEMORY FLOW                              |
+------------------------------------------------------------------+
|                                                                   |
|  SESSION START                                                    |
|  +-------------------+                                            |
|  | 1. Recall         |---> Query cached patterns for context      |
|  |    Patterns       |---> Semantic match: current task -> history|
|  +-------------------+                                            |
|           |                                                       |
|           v                                                       |
|  +-------------------+                                            |
|  | 2. Inject         |---> Enrich agent context with patterns     |
|  |    Context        |---> "User typically does X when Y"         |
|  +-------------------+                                            |
|           |                                                       |
|           v                                                       |
|  SESSION EXECUTION                                                |
|  +-------------------+                                            |
|  | 3. Agent          |---> Execute with pattern-informed behavior |
|  |    Actions        |---> Track tools used, outcomes             |
|  +-------------------+                                            |
|           |                                                       |
|           v                                                       |
|  SESSION END                                                      |
|  +-------------------+                                            |
|  | 4. Record         |---> Store: trigger -> actions -> outcome   |
|  |    Pattern        |---> Generate embedding for future recall   |
|  +-------------------+                                            |
|                                                                   |
+------------------------------------------------------------------+
```

## Memory Types for Behavior Patterns

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

// Find related memories using vector similarity
memory_find_related({
  memory_id: "uuid",
  user_id: "uuid",
  limit: 10,
  similarity_threshold: 0.7
})

// Extract insights from memories
memory_extract_insights({
  user_id: "uuid",
  topic: "deployment",
  memory_type: "workflow",
  max_memories: 20
})
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
Embeddings are normally generated by the API on first ingest and then cached locally for fast/offline recall (`processingMode: 'offline-fallback'`, `detectDuplicates`); client-side embedding generation is only permitted as a fallback when the API is unavailable or when privacy-sensitive data must never leave the client.

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
