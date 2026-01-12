# MCP Server Upgrade Guide: Behavior Tools

## Overview

This guide provides the MCP tool registrations needed for behavior intelligence in `server/mcp-server.ts`.

## Tools to Register

| Tool Name | Purpose | Read-Only |
|-----------|---------|-----------|
| `behavior_record` | Store workflow patterns | No |
| `behavior_recall` | Query patterns for context | Yes |
| `behavior_suggest` | Suggest next actions | Yes |

---

## Tool Registration Code

Add these tool registrations to the `createMCPServer` function in `server/mcp-server.ts`:

```typescript
import { z } from 'zod';

// =============================================================================
// BEHAVIOR INTELLIGENCE TOOLS (v2.0)
// =============================================================================

/**
 * Tool: behavior_record
 * Records a successful workflow pattern for future recall
 */
server.registerTool(
  'behavior_record',
  {
    title: 'Record Behavior Pattern',
    description: 'Record a successful workflow pattern for future recall and learning. Use this after completing a task successfully to help the system learn from the experience.',
    inputSchema: z.object({
      user_id: z.string().uuid().describe('User ID'),
      trigger: z.string().min(10).max(500).describe('What initiated this workflow (the task or prompt)'),
      context: z.object({
        directory: z.string().describe('Working directory'),
        project_type: z.string().optional().describe('Project type (e.g., typescript-api)'),
        branch: z.string().optional().describe('Git branch name'),
        files_touched: z.array(z.string()).optional().describe('Files modified during workflow')
      }).describe('Execution context'),
      actions: z.array(z.object({
        tool: z.string().describe('Tool name used'),
        parameters: z.record(z.any()).describe('Tool parameters'),
        outcome: z.enum(['success', 'partial', 'failed']).describe('Action outcome'),
        timestamp: z.string().datetime().describe('When action occurred'),
        duration_ms: z.number().optional().describe('Execution time in ms')
      })).describe('Sequence of actions performed'),
      final_outcome: z.enum(['success', 'partial', 'failed']).describe('Overall workflow outcome'),
      confidence: z.number().min(0).max(1).default(0.7).describe('Confidence in this pattern (0.0-1.0)')
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
        context: {
          directory: rawParams.context.directory,
          projectType: rawParams.context.project_type,
          branch: rawParams.context.branch,
          filesTouched: rawParams.context.files_touched
        },
        actions: rawParams.actions,
        finalOutcome: rawParams.final_outcome,
        confidence: rawParams.confidence
      });

      const pattern = response.data;

      return {
        content: [{
          type: 'text',
          text: `# Behavior Pattern Recorded

**Pattern ID:** ${pattern.id}
**Trigger:** ${pattern.trigger.substring(0, 100)}...
**Actions:** ${pattern.actions.length} steps
**Confidence:** ${Math.round(pattern.confidence * 100)}%
**Outcome:** ${pattern.final_outcome}

This pattern will be used to inform future similar tasks.`
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error recording behavior: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

/**
 * Tool: behavior_recall
 * Recalls relevant behavior patterns for the current context
 */
server.registerTool(
  'behavior_recall',
  {
    title: 'Recall Behavior Patterns',
    description: 'Recall relevant behavior patterns for the current task context. Use this at the start of a task to learn from previous similar experiences.',
    inputSchema: z.object({
      user_id: z.string().uuid().describe('User ID'),
      context: z.object({
        current_directory: z.string().describe('Current working directory'),
        current_task: z.string().describe('Description of current task'),
        project_type: z.string().optional().describe('Project type filter')
      }).describe('Current context'),
      limit: z.number().int().min(1).max(10).default(5).describe('Maximum patterns to return'),
      similarity_threshold: z.number().min(0).max(1).default(0.7).describe('Minimum similarity score'),
      response_format: z.enum(['json', 'markdown']).default('markdown').describe('Output format')
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

      if (rawParams.response_format === 'json') {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      // Markdown format
      let md = `# Relevant Behavior Patterns

**Task:** ${rawParams.context.current_task}
**Found:** ${result.total_found} patterns
**Source:** ${response.fromCache ? 'Local Cache (fast)' : 'API'}

`;

      if (result.patterns.length === 0) {
        md += `No matching patterns found. This appears to be a new type of task.`;
      } else {
        for (const { pattern, similarity_score, relevance_reason } of result.patterns) {
          md += `## ${pattern.trigger.substring(0, 60)}...

**Similarity:** ${Math.round(similarity_score * 100)}%
**Confidence:** ${Math.round(pattern.confidence * 100)}%
**Used:** ${pattern.use_count} time${pattern.use_count !== 1 ? 's' : ''}

**Action Chain:**
`;
          for (const action of pattern.actions) {
            const icon = action.outcome === 'success' ? '✓' : action.outcome === 'partial' ? '~' : '✗';
            md += `- ${icon} \`${action.tool}\`\n`;
          }
          md += `\n`;
        }
      }

      return {
        content: [{ type: 'text', text: md }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error recalling behavior: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

/**
 * Tool: behavior_suggest
 * Suggests next actions based on learned patterns
 */
server.registerTool(
  'behavior_suggest',
  {
    title: 'Suggest Next Actions',
    description: 'Get AI-powered suggestions for next actions based on learned behavior patterns. Use this when unsure what step to take next.',
    inputSchema: z.object({
      user_id: z.string().uuid().describe('User ID'),
      current_state: z.object({
        task_description: z.string().describe('What task is being worked on'),
        completed_steps: z.array(z.string()).describe('Steps already completed'),
        current_files: z.array(z.string()).optional().describe('Files currently being worked on')
      }).describe('Current execution state'),
      max_suggestions: z.number().int().min(1).max(5).default(3).describe('Maximum suggestions'),
      response_format: z.enum(['json', 'markdown']).default('markdown').describe('Output format')
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

      if (rawParams.response_format === 'json') {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      // Markdown format
      let md = `# Suggested Next Actions

**Task:** ${rawParams.current_state.task_description}
**Completed:** ${rawParams.current_state.completed_steps.length} steps

`;

      if (result.suggestions.length === 0) {
        md += `No suggestions available. This may be a unique workflow without prior patterns.`;
      } else {
        for (let i = 0; i < result.suggestions.length; i++) {
          const suggestion = result.suggestions[i];
          md += `## ${i + 1}. ${suggestion.action}

**Tool:** \`${suggestion.tool}\`
**Confidence:** ${Math.round(suggestion.confidence * 100)}%
**Reasoning:** ${suggestion.reasoning}

`;
        }
      }

      return {
        content: [{ type: 'text', text: md }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Error suggesting behavior: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);
```

---

## Updated Tool List

After adding these tools, your MCP server exposes:

### Memory Intelligence Tools (v1.x)
| Tool | Purpose |
|------|---------|
| `memory_analyze_patterns` | Analyze usage patterns |
| `memory_suggest_tags` | AI tag suggestions |
| `memory_find_related` | Semantic similarity search |
| `memory_detect_duplicates` | Find duplicate memories |
| `memory_extract_insights` | Extract insights |
| `memory_health_check` | Organization health |

### Behavior Intelligence Tools (v2.0)
| Tool | Purpose |
|------|---------|
| `behavior_record` | Store workflow patterns |
| `behavior_recall` | Query patterns by context |
| `behavior_suggest` | Suggest next actions |

---

## Tool Usage Examples

### Recording a Pattern (Claude/Agent)

```
I'll record this successful workflow for future reference.

<tool_call>
behavior_record({
  user_id: "550e8400-e29b-41d4-a716-446655440000",
  trigger: "Fix authentication middleware in Express app",
  context: {
    directory: "/home/user/my-api",
    project_type: "express-api",
    branch: "fix/auth-middleware"
  },
  actions: [
    {
      tool: "Read",
      parameters: { file: "middleware/auth.js" },
      outcome: "success",
      timestamp: "2026-01-12T15:00:00Z"
    },
    {
      tool: "Edit",
      parameters: { file: "middleware/auth.js", changes: "..." },
      outcome: "success",
      timestamp: "2026-01-12T15:05:00Z"
    },
    {
      tool: "Bash",
      parameters: { command: "npm test" },
      outcome: "success",
      timestamp: "2026-01-12T15:10:00Z"
    }
  ],
  final_outcome: "success",
  confidence: 0.9
})
</tool_call>
```

### Recalling Patterns

```
Let me check for similar past workflows.

<tool_call>
behavior_recall({
  user_id: "550e8400-e29b-41d4-a716-446655440000",
  context: {
    current_directory: "/home/user/another-api",
    current_task: "Fix authentication bug",
    project_type: "express-api"
  },
  limit: 3,
  similarity_threshold: 0.7
})
</tool_call>
```

### Getting Suggestions

```
What should I do next?

<tool_call>
behavior_suggest({
  user_id: "550e8400-e29b-41d4-a716-446655440000",
  current_state: {
    task_description: "Fix authentication middleware",
    completed_steps: ["Read auth.js file"],
    current_files: ["middleware/auth.js"]
  },
  max_suggestions: 3
})
</tool_call>
```

---

## Testing MCP Tools

```bash
# Test via MCP inspector or direct tool call
npx @modelcontextprotocol/inspector

# Or programmatically
node -e "
const { createMCPServer } = require('./dist/server');
const server = createMCPServer({ apiKey: 'lano_xxx' });

// List tools
const tools = server.listTools();
console.log('Registered tools:', tools.map(t => t.name));

// Should include: behavior_record, behavior_recall, behavior_suggest
"
```

---

## Next Steps

1. Proceed to [03-rest-api-upgrade.md](./03-rest-api-upgrade.md) for REST integration
2. Or skip to [04-database-migration.md](./04-database-migration.md) for database setup
