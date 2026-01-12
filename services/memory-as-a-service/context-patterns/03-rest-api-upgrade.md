# REST API Integration Guide

## Overview

The behavior intelligence feature uses **existing REST endpoints** with specific parameters. No new endpoints are required for the MVP.

## Endpoint Mapping

| Behavior Operation | REST Endpoint | Method | Key Parameters |
|--------------------|---------------|--------|----------------|
| Record pattern | `/memories` | POST | `type: "workflow"` |
| Recall patterns | `/memories/search` | POST | `type: "workflow"` |
| Update use_count | `/memories/{id}` | PUT | `metadata.use_count` |
| List patterns | `/memories` | GET | `type=workflow` |

---

## 1. Recording Behavior Patterns

### Endpoint
```
POST /api/v1/memories
```

### Request Body
```json
{
  "title": "Workflow: Fix authentication bug in login flow",
  "content": "{\"trigger\":\"fix auth bug\",\"actions\":[{\"tool\":\"Read\",\"parameters\":{\"file\":\"auth.ts\"},\"outcome\":\"success\",\"timestamp\":\"2026-01-12T15:00:00Z\"},{\"tool\":\"Edit\",\"parameters\":{\"file\":\"auth.ts\"},\"outcome\":\"success\",\"timestamp\":\"2026-01-12T15:05:00Z\"},{\"tool\":\"Bash\",\"parameters\":{\"command\":\"npm test\"},\"outcome\":\"success\",\"timestamp\":\"2026-01-12T15:10:00Z\"}],\"final_outcome\":\"success\",\"duration_ms\":600000}",
  "type": "workflow",
  "tags": ["behavior-pattern", "typescript-api", "auth", "bugfix"],
  "metadata": {
    "confidence": 0.85,
    "use_count": 1,
    "context": {
      "directory": "/home/user/onasis-gateway",
      "project_type": "typescript-api",
      "branch": "main",
      "files_touched": ["src/auth.ts", "src/auth.test.ts"]
    }
  }
}
```

### Response
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Workflow: Fix authentication bug in login flow",
    "content": "...",
    "type": "workflow",
    "tags": ["behavior-pattern", "typescript-api", "auth", "bugfix"],
    "metadata": {
      "confidence": 0.85,
      "use_count": 1,
      "context": { ... }
    },
    "created_at": "2026-01-12T15:15:00Z",
    "updated_at": "2026-01-12T15:15:00Z"
  }
}
```

### cURL Example
```bash
curl -X POST "https://api.lanonasis.com/api/v1/memories" \
  -H "X-API-Key: lano_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Workflow: Fix auth bug",
    "content": "{\"trigger\":\"fix auth\",\"actions\":[],\"final_outcome\":\"success\"}",
    "type": "workflow",
    "tags": ["behavior-pattern"],
    "metadata": {"confidence": 0.8, "use_count": 1}
  }'
```

---

## 2. Recalling Behavior Patterns

### Endpoint
```
POST /api/v1/memories/search
```

### Request Body
```json
{
  "query": "fix authentication bug in typescript",
  "type": "workflow",
  "threshold": 0.7,
  "limit": 5
}
```

### Response
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Workflow: Fix authentication bug in login flow",
        "content": "...",
        "type": "workflow",
        "similarity_score": 0.89,
        "tags": ["behavior-pattern", "typescript-api"],
        "metadata": {
          "confidence": 0.85,
          "use_count": 3
        }
      }
    ],
    "total": 1,
    "query": "fix authentication bug in typescript",
    "threshold": 0.7
  }
}
```

### cURL Example
```bash
curl -X POST "https://api.lanonasis.com/api/v1/memories/search" \
  -H "X-API-Key: lano_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "fix authentication bug",
    "type": "workflow",
    "threshold": 0.7,
    "limit": 5
  }'
```

---

## 3. Updating Pattern Usage

When a pattern is recalled and used, increment `use_count`:

### Endpoint
```
PUT /api/v1/memories/{id}
```

### Request Body
```json
{
  "metadata": {
    "use_count": 4,
    "last_used_at": "2026-01-12T16:00:00Z"
  }
}
```

### cURL Example
```bash
curl -X PUT "https://api.lanonasis.com/api/v1/memories/550e8400-e29b-41d4-a716-446655440000" \
  -H "X-API-Key: lano_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "use_count": 4,
      "last_used_at": "2026-01-12T16:00:00Z"
    }
  }'
```

---

## 4. Listing Workflow Patterns

### Endpoint
```
GET /api/v1/memories?type=workflow&sortBy=updated_at&sortOrder=desc
```

### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by `workflow` |
| `tags` | string | Comma-separated tags (e.g., `behavior-pattern,typescript-api`) |
| `sortBy` | string | Sort field (`created_at`, `updated_at`, `title`) |
| `sortOrder` | string | `asc` or `desc` |
| `limit` | number | Max results (default: 20, max: 100) |
| `offset` | number | Pagination offset |

### cURL Example
```bash
curl -X GET "https://api.lanonasis.com/api/v1/memories?type=workflow&limit=10" \
  -H "X-API-Key: lano_xxx"
```

---

## Content Schema

The `content` field stores JSON-stringified workflow data:

```typescript
interface WorkflowContent {
  trigger: string;           // What initiated this workflow
  actions: ToolAction[];     // Sequence of tool calls
  final_outcome: 'success' | 'partial' | 'failed';
  duration_ms?: number;      // Total duration
}

interface ToolAction {
  tool: string;              // Tool name (e.g., "Read", "Edit", "Bash")
  parameters: object;        // Tool parameters
  outcome: 'success' | 'partial' | 'failed';
  timestamp: string;         // ISO timestamp
  duration_ms?: number;      // Action duration
}
```

---

## Metadata Schema

The `metadata` field stores behavior-specific data:

```typescript
interface BehaviorMetadata {
  confidence: number;        // 0.0 - 1.0
  use_count: number;         // Times this pattern was recalled
  last_used_at?: string;     // ISO timestamp of last recall
  context: {
    directory: string;       // Working directory
    project_type?: string;   // e.g., "typescript-api"
    branch?: string;         // Git branch
    files_touched?: string[]; // Modified files
  };
}
```

---

## Future Dedicated Endpoints (Optional)

For a cleaner API surface, consider adding dedicated endpoints:

```yaml
# Future addition to OpenAPI spec

/behaviors/record:
  post:
    summary: Record Behavior Pattern
    description: Smart recording with deduplication

/behaviors/recall:
  post:
    summary: Recall Behavior Patterns
    description: Context-aware pattern retrieval

/behaviors/suggest:
  post:
    summary: Suggest Next Actions
    description: AI-powered action suggestions
```

These would wrap the existing `/memories` endpoints with behavior-specific logic.

---

## Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Invalid request body | Check JSON schema |
| 401 | Authentication failed | Check API key |
| 404 | Memory not found | Verify ID exists |
| 429 | Rate limit exceeded | Implement backoff |

---

## Next Steps

1. Proceed to [04-database-migration.md](./04-database-migration.md) for schema setup
2. Or [05-edge-functions.md](./05-edge-functions.md) for Supabase edge functions
