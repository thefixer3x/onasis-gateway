#!/usr/bin/env node

/**
 * Memory as a Service (MaaS) Client Adapter
 * Integrates with Lanonasis Memory Service API
 */

const BaseClient = require('../../core/base-client');
const ComplianceManager = require('../../core/security/compliance-manager');

class MemoryServiceClient extends BaseClient {
  constructor(config = {}) {
    super({
      name: 'Memory as a Service',
      id: 'memory-as-a-service',
      baseUrl: config.baseUrl || process.env.MEMORY_API_URL || 'https://api.lanonasis.com',
      apiKey: config.apiKey || process.env.MEMORY_API_KEY,
      version: '1.0.0',
      ...config
    });

    this.compliance = new ComplianceManager();
    this.loadServiceDefinition();
  }

  loadServiceDefinition() {
    try {
      this.serviceDefinition = require('./memory-service.json');
      this.endpoints = this.serviceDefinition.endpoints;
    } catch (error) {
      console.error('Failed to load Memory service definition:', error);
      this.endpoints = {};
    }
  }

  /**
   * Health check for Memory service
   */
  async healthCheck() {
    try {
      const response = await this.makeRequest('GET', '/api/v1/health');
      return {
        service: 'memory-as-a-service',
        status: response.status === 'healthy' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        responseTime: response.responseTime || 'N/A',
        details: response
      };
    } catch (error) {
      return {
        service: 'memory-as-a-service',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Create a new memory entry
   */
  async createMemory(memoryData) {
    // Apply GDPR and security compliance
    const processedData = this.compliance.enforceDataHandling(
      'memory-as-a-service',
      memoryData,
      'create'
    );

    const response = await this.makeRequest('POST', '/api/v1/memory', processedData);
    
    // Emit webhook event
    this.emit('memory.created', {
      memory_id: response.id,
      user_id: response.user_id,
      memory_type: response.memory_type,
      created_at: response.created_at
    });

    return response;
  }

  /**
   * Search memories using semantic search
   */
  async searchMemories(searchQuery) {
    // Validate search parameters
    if (!searchQuery.query || searchQuery.query.length < 1) {
      throw new Error('Search query is required');
    }

    const searchData = {
      query: searchQuery.query,
      limit: Math.min(searchQuery.limit || 20, 100),
      threshold: Math.max(0, Math.min(searchQuery.threshold || 0.7, 1)),
      memory_types: searchQuery.memory_types || undefined,
      tags: searchQuery.tags || undefined
    };

    const response = await this.makeRequest('POST', '/api/v1/memory/search', searchData);
    
    // Track search analytics
    this.trackUsage('search', {
      query_length: searchQuery.query.length,
      result_count: response.results?.length || 0,
      search_time_ms: response.search_time_ms || 0
    });

    return response;
  }

  /**
   * Get a specific memory by ID
   */
  async getMemory(memoryId) {
    if (!memoryId) {
      throw new Error('Memory ID is required');
    }

    const response = await this.makeRequest('GET', `/api/v1/memory/${memoryId}`);
    
    // Track memory access
    this.trackUsage('memory_access', {
      memory_id: memoryId,
      memory_type: response.memory_type
    });

    return response;
  }

  /**
   * Update an existing memory
   */
  async updateMemory(memoryId, updateData) {
    if (!memoryId) {
      throw new Error('Memory ID is required');
    }

    // Apply compliance for update operations
    const processedData = this.compliance.enforceDataHandling(
      'memory-as-a-service',
      updateData,
      'update'
    );

    const response = await this.makeRequest('PUT', `/api/v1/memory/${memoryId}`, processedData);
    
    // Emit webhook event
    this.emit('memory.updated', {
      memory_id: memoryId,
      user_id: response.user_id,
      changes: Object.keys(updateData),
      updated_at: response.updated_at
    });

    return response;
  }

  /**
   * Delete a memory entry
   */
  async deleteMemory(memoryId) {
    if (!memoryId) {
      throw new Error('Memory ID is required');
    }

    const response = await this.makeRequest('DELETE', `/api/v1/memory/${memoryId}`);
    
    // Emit webhook event for GDPR compliance
    this.emit('memory.deleted', {
      memory_id: memoryId,
      user_id: response.user_id || 'unknown',
      deleted_at: new Date().toISOString()
    });

    return response;
  }

  /**
   * List memories with pagination and filtering
   */
  async listMemories(options = {}) {
    const queryParams = new URLSearchParams();
    
    if (options.page) queryParams.append('page', options.page);
    if (options.limit) queryParams.append('limit', Math.min(options.limit, 100));
    if (options.memory_type) queryParams.append('memory_type', options.memory_type);
    if (options.tags) queryParams.append('tags', Array.isArray(options.tags) ? options.tags.join(',') : options.tags);
    if (options.sort) queryParams.append('sort', options.sort);
    if (options.order) queryParams.append('order', options.order);

    const url = `/api/v1/memory${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return await this.makeRequest('GET', url);
  }

  /**
   * Get memory statistics and analytics
   */
  async getMemoryStats() {
    return await this.makeRequest('GET', '/api/v1/memory/stats');
  }

  /**
   * Bulk delete multiple memories (Pro/Enterprise feature)
   */
  async bulkDeleteMemories(memoryIds) {
    if (!Array.isArray(memoryIds) || memoryIds.length === 0) {
      throw new Error('Memory IDs array is required');
    }

    if (memoryIds.length > 100) {
      throw new Error('Cannot delete more than 100 memories at once');
    }

    const response = await this.makeRequest('POST', '/api/v1/memory/bulk/delete', {
      memory_ids: memoryIds
    });

    // Emit bulk deletion event
    this.emit('memory.bulk_deleted', {
      memory_ids: memoryIds,
      deleted_count: response.deleted_count,
      failed_ids: response.failed_ids || [],
      deleted_at: new Date().toISOString()
    });

    return response;
  }

  /**
   * Create a new memory topic/category
   */
  async createTopic(topicData) {
    const processedData = this.compliance.enforceDataHandling(
      'memory-as-a-service',
      topicData,
      'create'
    );

    return await this.makeRequest('POST', '/api/v1/topics', processedData);
  }

  /**
   * Get all memory topics
   */
  async getTopics() {
    return await this.makeRequest('GET', '/api/v1/topics');
  }

  /**
   * Validate API key format
   */
  validateApiKey(apiKey) {
    if (!apiKey) return false;
    
    // Check for Onasis Gateway format: onasis_[base64]
    const onasisFormat = /^onasis_[A-Za-z0-9+/]+=*$/;
    if (onasisFormat.test(apiKey)) return true;

    // Check for legacy format
    const legacyFormat = /^[A-Za-z0-9_-]{32,}$/;
    return legacyFormat.test(apiKey);
  }

  /**
   * Get service capabilities and features
   */
  getCapabilities() {
    return {
      name: 'Memory as a Service',
      version: '1.0.0',
      features: [
        'Semantic Search',
        'Vector Storage',
        'Multi-tenant Support',
        'Topic Organization',
        'Bulk Operations',
        'Real-time Analytics',
        'GDPR Compliance',
        'Enterprise SSO'
      ],
      endpoints: Object.keys(this.endpoints || {}),
      authMethods: ['api_key', 'jwt'],
      rateLimits: {
        free: '1000/hour',
        pro: '10000/hour',
        enterprise: 'unlimited'
      }
    };
  }

  /**
   * Test connection and authentication
   */
  async testConnection() {
    try {
      const health = await this.healthCheck();
      if (health.status !== 'healthy') {
        throw new Error(`Service unhealthy: ${health.error || 'Unknown error'}`);
      }

      // Test authenticated endpoint
      await this.getMemoryStats();
      
      return {
        success: true,
        message: 'Connection successful',
        service: 'Memory as a Service',
        capabilities: this.getCapabilities()
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        service: 'Memory as a Service'
      };
    }
  }
}

module.exports = MemoryServiceClient;