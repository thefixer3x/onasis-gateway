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
