/**
 * Intelligence API Adapter
 * MCP adapter for intelligence and analytics services using Supabase Edge Functions
 * Based on the actual Supabase API specification from the monorepo
 */

const BaseMCPAdapter = require('../../core/base-mcp-adapter');
const UniversalSupabaseClient = require('../../core/universal-supabase-client');

class IntelligenceAdapter extends BaseMCPAdapter {
  constructor(config = {}) {
    super({
      id: 'intelligence-api',
      name: 'Intelligence API',
      description: 'AI-powered memory intelligence and analytics services',
      category: 'analytics',
      capabilities: ['pattern_analysis', 'tag_suggestion', 'related_memory_finding', 'duplicate_detection', 'insight_extraction', 'health_check'],
      client: new UniversalSupabaseClient({
        serviceName: 'intelligence-api',
        functionName: 'intelligence-api', // This will be overridden per call
        timeout: 30000
      }),
      ...config
    });
  }

  async initialize() {
    // Define the tools for the intelligence API based on actual Supabase API
    this.tools = [
      {
        name: 'intelligence-analyze-patterns',
        description: 'Analyze usage patterns and trends across your memory collection. Returns insights about memory creation habits, type distribution, peak hours, and AI-generated recommendations. Premium feature with usage quotas based on subscription tier.',
        inputSchema: {
          type: 'object',
          properties: {
            time_range_days: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 365, 
              default: 30,
              description: 'Number of days to analyze' 
            },
            include_insights: { 
              type: 'boolean', 
              default: true,
              description: 'Include AI-generated insights' 
            },
            response_format: { 
              type: 'string', 
              enum: ['json', 'markdown'], 
              default: 'json',
              description: 'Response format' 
            }
          }
        }
      },
      {
        name: 'intelligence-suggest-tags',
        description: 'Get AI-powered tag suggestions for a memory based on its content. Uses context from user\'s existing tag vocabulary for consistency. Premium feature with usage quotas.',
        inputSchema: {
          type: 'object',
          properties: {
            memory_id: { 
              type: 'string', 
              format: 'uuid',
              description: 'UUID of the memory to analyze' 
            },
            content: { 
              type: 'string', 
              description: 'Raw content to analyze (alternative to memory_id)' 
            },
            title: { 
              type: 'string', 
              description: 'Title for context (used with content)' 
            },
            existing_tags: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Tags already on the memory' 
            },
            max_suggestions: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 10, 
              default: 5,
              description: 'Maximum number of suggestions' 
            }
          },
          required: ['memory_id'] // At least one of memory_id or content is required
        }
      },
      {
        name: 'intelligence-find-related',
        description: 'Find semantically related memories using vector similarity search. Supports both memory-based and query-based search. Premium feature with usage quotas.',
        inputSchema: {
          type: 'object',
          properties: {
            memory_id: { 
              type: 'string', 
              format: 'uuid',
              description: 'Source memory to find related items for' 
            },
            query: { 
              type: 'string', 
              description: 'Text query (alternative to memory_id)' 
            },
            limit: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 20, 
              default: 5,
              description: 'Maximum number of related memories to return' 
            },
            similarity_threshold: { 
              type: 'number', 
              minimum: 0, 
              maximum: 1, 
              default: 0.7,
              description: 'Similarity threshold' 
            },
            exclude_ids: { 
              type: 'array', 
              items: { type: 'string', format: 'uuid' },
              description: 'Memory IDs to exclude from results' 
            }
          }
        }
      },
      {
        name: 'intelligence-detect-duplicates',
        description: 'Find potential duplicate or very similar memories. Uses semantic similarity when embeddings are available, falls back to text similarity. Premium feature with usage quotas.',
        inputSchema: {
          type: 'object',
          properties: {
            similarity_threshold: { 
              type: 'number', 
              minimum: 0.8, 
              maximum: 0.99, 
              default: 0.85,
              description: 'Minimum similarity to consider as duplicate' 
            },
            include_archived: { 
              type: 'boolean', 
              default: false,
              description: 'Include archived memories in search' 
            },
            limit: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 50, 
              default: 20,
              description: 'Maximum duplicate groups to return' 
            }
          }
        }
      },
      {
        name: 'intelligence-extract-insights',
        description: 'Extract actionable insights and summaries from memories using AI analysis. Supports theme detection, connection finding, gap analysis, and action item extraction. Premium feature with usage quotas.',
        inputSchema: {
          type: 'object',
          properties: {
            memory_ids: { 
              type: 'array', 
              items: { type: 'string', format: 'uuid' },
              description: 'Specific memories to analyze' 
            },
            topic: { 
              type: 'string', 
              maxLength: 200,
              description: 'Topic filter for memories' 
            },
            time_range_days: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 365, 
              default: 30,
              description: 'Time range to analyze' 
            },
            insight_types: { 
              type: 'array', 
              items: { type: 'string', enum: ['themes', 'connections', 'gaps', 'actions', 'summary'] },
              default: ['themes', 'connections', 'actions'],
              description: 'Types of insights to extract' 
            },
            detail_level: { 
              type: 'string', 
              enum: ['brief', 'detailed', 'comprehensive'], 
              default: 'detailed',
              description: 'Level of detail for insights' 
            }
          }
        }
      },
      {
        name: 'intelligence-health-check',
        description: 'Get a health score and recommendations for your memory organization. Analyzes tagging, recency, completeness, organization, and diversity. Premium feature with usage quotas.',
        inputSchema: {
          type: 'object',
          properties: {
            include_recommendations: { 
              type: 'boolean', 
              default: true,
              description: 'Include AI-generated recommendations' 
            },
            detailed_breakdown: { 
              type: 'boolean', 
              default: true,
              description: 'Include detailed score breakdown' 
            }
          }
        }
      },
      {
        name: 'intelligence-behavior-record',
        description: 'Record a behavior/workflow pattern with embedding generation and deduplication. If a near-duplicate is found, the existing pattern is updated instead of creating a new one.',
        inputSchema: {
          type: 'object',
          properties: {
            pattern_name: { 
              type: 'string', 
              description: 'Name for the behavior pattern' 
            },
            description: { 
              type: 'string', 
              description: 'Description of the behavior pattern' 
            },
            context: { 
              type: 'string', 
              description: 'Context in which this pattern occurs' 
            },
            steps: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Steps in the behavior pattern' 
            },
            tags: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Tags for organizing the pattern' 
            }
          },
          required: ['pattern_name', 'description']
        }
      },
      {
        name: 'intelligence-behavior-recall',
        description: 'Recall relevant behavior patterns using vector similarity search. Useful for surfacing likely next steps based on current task context.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { 
              type: 'string', 
              description: 'Query to match against behavior patterns' 
            },
            context: { 
              type: 'string', 
              description: 'Current context to match against patterns' 
            },
            limit: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 10, 
              default: 5,
              description: 'Maximum number of patterns to return' 
            }
          },
          required: ['query']
        }
      },
      {
        name: 'intelligence-behavior-suggest',
        description: 'Generate action suggestions based on recalled behavior patterns. Useful for proposing the next likely tools or steps.',
        inputSchema: {
          type: 'object',
          properties: {
            current_context: { 
              type: 'string', 
              description: 'Current task context' 
            },
            previous_actions: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Previous actions taken' 
            },
            limit: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 10, 
              default: 5,
              description: 'Maximum number of suggestions to return' 
            }
          }
        }
      }
    ];
    this._initialized = true;
  }

  async callTool(toolName, args, context = {}) {
    this._stats.calls++;
    this._stats.lastCall = new Date().toISOString();
    
    try {
      // Map tool names to their dedicated Edge Functions based on actual API
      const functionMap = {
        'intelligence-analyze-patterns': 'intelligence/analyze-patterns',
        'intelligence-suggest-tags': 'intelligence/suggest-tags',
        'intelligence-find-related': 'intelligence/find-related',
        'intelligence-detect-duplicates': 'intelligence/detect-duplicates',
        'intelligence-extract-insights': 'intelligence/extract-insights',
        'intelligence-health-check': 'intelligence/health-check',
        'intelligence-behavior-record': 'intelligence/behavior-record',
        'intelligence-behavior-recall': 'intelligence/behavior-recall',
        'intelligence-behavior-suggest': 'intelligence/behavior-suggest'
      };
      
      const functionName = functionMap[toolName];
      
      if (!functionName) {
        throw new Error(`Unknown intelligence tool: ${toolName}`);
      }
      
      // Determine the HTTP method based on the tool
      // Most intelligence tools are POST, but some may be GET
      const method = 'POST';
      
      // Make the call to the appropriate Supabase Edge Function
      const result = await this.client.call(functionName, args, {
        ...context,
        method: method
      });
      
      return result;
    } catch (error) {
      this._stats.errors++;
      throw error;
    }
  }
}

module.exports = IntelligenceAdapter;