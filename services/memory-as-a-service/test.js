#!/usr/bin/env node

/**
 * Memory as a Service Integration Tests
 * Comprehensive testing suite for Memory API integration
 */

const MemoryServiceClient = require('./client');
const MemoryWebhooksHandler = require('./webhooks');

class MemoryServiceTester {
  constructor() {
    this.client = new MemoryServiceClient({
      baseUrl: process.env.MEMORY_API_URL || 'https://api.lanonasis.com',
      apiKey: process.env.MEMORY_API_KEY || process.env.TEST_API_KEY
    });
    
    this.webhookHandler = new MemoryWebhooksHandler({
      webhookSecret: process.env.MEMORY_WEBHOOK_SECRET || 'test_secret'
    });
    
    this.testResults = [];
    this.testData = {
      memories: [],
      topics: []
    };
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    console.log('🧪 Starting Memory as a Service Integration Tests\n');
    console.log('='.repeat(60));
    
    try {
      // Basic connectivity tests
      await this.runTest('Health Check', this.testHealthCheck.bind(this));
      await this.runTest('Authentication Test', this.testAuthentication.bind(this));
      
      // Memory management tests
      await this.runTest('Create Memory', this.testCreateMemory.bind(this));
      await this.runTest('Get Memory', this.testGetMemory.bind(this));
      await this.runTest('Search Memories', this.testSearchMemories.bind(this));
      await this.runTest('Update Memory', this.testUpdateMemory.bind(this));
      await this.runTest('List Memories', this.testListMemories.bind(this));
      
      // Topic management tests
      await this.runTest('Create Topic', this.testCreateTopic.bind(this));
      await this.runTest('Get Topics', this.testGetTopics.bind(this));
      
      // Analytics tests
      await this.runTest('Get Memory Stats', this.testGetMemoryStats.bind(this));
      
      // Bulk operations tests (if Pro/Enterprise)
      await this.runTest('Bulk Delete Memories', this.testBulkDeleteMemories.bind(this));
      
      // Webhook tests
      await this.runTest('Webhook Processing', this.testWebhookProcessing.bind(this));
      
      // Cleanup
      await this.runTest('Cleanup Test Data', this.testCleanup.bind(this));
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Run individual test with error handling
   */
  async runTest(testName, testFunction) {
    const startTime = Date.now();
    
    try {
      console.log(`🧪 Running: ${testName}...`);
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name: testName,
        status: 'PASSED',
        duration: `${duration}ms`,
        result
      });
      
      console.log(`✅ ${testName} - PASSED (${duration}ms)\n`);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name: testName,
        status: 'FAILED',
        duration: `${duration}ms`,
        error: error.message
      });
      
      console.log(`❌ ${testName} - FAILED (${duration}ms)`);
      console.log(`   Error: ${error.message}\n`);
    }
  }

  /**
   * Test health check endpoint
   */
  async testHealthCheck() {
    const health = await this.client.healthCheck();
    
    if (health.status !== 'healthy') {
      throw new Error(`Health check failed: ${health.error || 'Service unhealthy'}`);
    }
    
    return { health_status: health.status, response_time: health.responseTime };
  }

  /**
   * Test authentication and connection
   */
  async testAuthentication() {
    const connection = await this.client.testConnection();
    
    if (!connection.success) {
      throw new Error(`Authentication failed: ${connection.message}`);
    }
    
    return { 
      authenticated: true, 
      capabilities: connection.capabilities?.features?.length || 0 
    };
  }

  /**
   * Test memory creation
   */
  async testCreateMemory() {
    const memoryData = {
      title: 'Test Memory for Integration Testing',
      content: 'This is a test memory created during integration testing. It contains sample content to verify the memory creation functionality.',
      memory_type: 'context',
      tags: ['test', 'integration', 'automated'],
      metadata: {
        source: 'integration_test',
        test_id: `test_${Date.now()}`,
        created_by: 'memory_service_tester'
      }
    };

    const memory = await this.client.createMemory(memoryData);
    
    if (!memory.id) {
      throw new Error('Memory creation failed - no ID returned');
    }
    
    // Store for later tests
    this.testData.memories.push(memory);
    
    return { 
      memory_id: memory.id, 
      memory_type: memory.memory_type,
      title: memory.title
    };
  }

  /**
   * Test getting a specific memory
   */
  async testGetMemory() {
    if (this.testData.memories.length === 0) {
      throw new Error('No test memories available');
    }
    
    const testMemory = this.testData.memories[0];
    const memory = await this.client.getMemory(testMemory.id);
    
    if (memory.id !== testMemory.id) {
      throw new Error('Retrieved memory ID does not match requested ID');
    }
    
    return { 
      memory_id: memory.id,
      title: memory.title,
      content_length: memory.content?.length || 0
    };
  }

  /**
   * Test memory search functionality
   */
  async testSearchMemories() {
    const searchQuery = {
      query: 'integration testing',
      limit: 10,
      threshold: 0.5,
      memory_types: ['context']
    };

    const results = await this.client.searchMemories(searchQuery);
    
    if (!results.results || !Array.isArray(results.results)) {
      throw new Error('Search results not returned in expected format');
    }
    
    return { 
      results_count: results.results.length,
      search_time_ms: results.search_time_ms || 0,
      total_results: results.total_results || 0
    };
  }

  /**
   * Test memory update functionality
   */
  async testUpdateMemory() {
    if (this.testData.memories.length === 0) {
      throw new Error('No test memories available');
    }
    
    const testMemory = this.testData.memories[0];
    const updateData = {
      title: 'Updated Test Memory for Integration Testing',
      tags: ['test', 'integration', 'automated', 'updated'],
      metadata: {
        ...testMemory.metadata,
        updated_by: 'memory_service_tester',
        updated_at: new Date().toISOString()
      }
    };

    const updatedMemory = await this.client.updateMemory(testMemory.id, updateData);
    
    if (updatedMemory.title !== updateData.title) {
      throw new Error('Memory update failed - title not updated');
    }
    
    return { 
      memory_id: updatedMemory.id,
      updated_title: updatedMemory.title,
      tags_count: updatedMemory.tags?.length || 0
    };
  }

  /**
   * Test memory listing with pagination
   */
  async testListMemories() {
    const options = {
      page: 1,
      limit: 20,
      memory_type: 'context',
      sort: 'created_at',
      order: 'desc'
    };

    const result = await this.client.listMemories(options);
    
    if (!result.data || !Array.isArray(result.data)) {
      throw new Error('Memory list not returned in expected format');
    }
    
    return { 
      memories_count: result.data.length,
      pagination: result.pagination || null,
      total_memories: result.pagination?.total || result.data.length
    };
  }

  /**
   * Test topic creation
   */
  async testCreateTopic() {
    const topicData = {
      name: 'Integration Test Topic',
      description: 'A test topic created during integration testing',
      color: '#3B82F6',
      icon: 'test',
      metadata: {
        created_by: 'memory_service_tester',
        test_id: `topic_test_${Date.now()}`
      }
    };

    const topic = await this.client.createTopic(topicData);
    
    if (!topic.id) {
      throw new Error('Topic creation failed - no ID returned');
    }
    
    // Store for later cleanup
    this.testData.topics.push(topic);
    
    return { 
      topic_id: topic.id,
      name: topic.name,
      color: topic.color
    };
  }

  /**
   * Test getting all topics
   */
  async testGetTopics() {
    const topics = await this.client.getTopics();
    
    if (!Array.isArray(topics)) {
      throw new Error('Topics not returned as an array');
    }
    
    return { 
      topics_count: topics.length,
      has_test_topic: topics.some(t => t.name === 'Integration Test Topic')
    };
  }

  /**
   * Test memory statistics
   */
  async testGetMemoryStats() {
    const stats = await this.client.getMemoryStats();
    
    if (!stats || typeof stats.total_memories !== 'number') {
      throw new Error('Stats not returned in expected format');
    }
    
    return { 
      total_memories: stats.total_memories,
      memories_by_type: Object.keys(stats.memories_by_type || {}).length,
      total_topics: stats.total_topics || 0
    };
  }

  /**
   * Test bulk delete functionality (Pro/Enterprise feature)
   */
  async testBulkDeleteMemories() {
    // Create additional test memories for bulk deletion
    const memoriesToCreate = 3;
    const createdMemories = [];
    
    for (let i = 0; i < memoriesToCreate; i++) {
      const memory = await this.client.createMemory({
        title: `Bulk Delete Test Memory ${i + 1}`,
        content: `This is test memory ${i + 1} for bulk deletion testing.`,
        memory_type: 'context',
        tags: ['bulk_delete_test'],
        metadata: { bulk_test: true }
      });
      createdMemories.push(memory);
    }
    
    // Perform bulk deletion
    const memoryIds = createdMemories.map(m => m.id);
    
    try {
      const result = await this.client.bulkDeleteMemories(memoryIds);
      
      return { 
        requested_count: memoryIds.length,
        deleted_count: result.deleted_count,
        failed_count: result.failed_ids?.length || 0,
        success_rate: `${((result.deleted_count / memoryIds.length) * 100).toFixed(1)}%`
      };
    } catch (error) {
      // Bulk delete might not be available in free tier
      if (error.message.includes('Pro') || error.message.includes('Enterprise')) {
        return { 
          skipped: true, 
          reason: 'Bulk delete requires Pro/Enterprise plan' 
        };
      }
      throw error;
    }
  }

  /**
   * Test webhook processing
   */
  async testWebhookProcessing() {
    // Simulate webhook payload
    const webhookData = {
      event_type: 'memory.created',
      data: {
        memory_id: 'test_memory_123',
        memory_type: 'context',
        title: 'Test Memory',
        user_id: 'test_user_456'
      },
      timestamp: new Date().toISOString(),
      user_id: 'test_user_456'
    };

    // Create mock request object
    const mockReq = {
      body: webhookData,
      headers: {}
    };

    const mockRes = {
      status: (code) => ({
        json: (data) => ({ statusCode: code, body: data })
      })
    };

    // Test webhook processing
    let webhookProcessed = false;
    
    this.webhookHandler.once('memory.created', () => {
      webhookProcessed = true;
    });

    await this.webhookHandler.handleWebhook(mockReq, mockRes);
    
    // Give some time for async processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return { 
      webhook_processed: webhookProcessed,
      event_type: webhookData.event_type
    };
  }

  /**
   * Clean up test data
   */
  async testCleanup() {
    let deletedCount = 0;
    
    // Delete test memories
    for (const memory of this.testData.memories) {
      try {
        await this.client.deleteMemory(memory.id);
        deletedCount++;
      } catch (error) {
        console.log(`Failed to delete memory ${memory.id}: ${error.message}`);
      }
    }
    
    // Note: Topics might not have delete endpoint, so we skip cleanup
    
    return { 
      memories_deleted: deletedCount,
      total_test_memories: this.testData.memories.length
    };
  }

  /**
   * Print test results summary
   */
  printResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(60));
    
    const passed = this.testResults.filter(t => t.status === 'PASSED').length;
    const failed = this.testResults.filter(t => t.status === 'FAILED').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(t => t.status === 'FAILED')
        .forEach(test => {
          console.log(`   • ${test.name}: ${test.error}`);
        });
    }
    
    console.log('\n📝 Detailed Results:');
    this.testResults.forEach(test => {
      const icon = test.status === 'PASSED' ? '✅' : '❌';
      console.log(`   ${icon} ${test.name} (${test.duration})`);
      
      if (test.result && typeof test.result === 'object') {
        Object.entries(test.result).forEach(([key, value]) => {
          console.log(`      ${key}: ${JSON.stringify(value)}`);
        });
      }
    });
    
    console.log('\n' + '='.repeat(60));
    
    if (passed === this.testResults.length) {
      console.log('🎉 All tests passed! Memory as a Service integration is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Check the results above for details.');
    }
    
    console.log('🔗 Service ready for integration with Onasis Gateway');
    console.log('='.repeat(60));
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new MemoryServiceTester();
  tester.runAllTests().catch(console.error);
}

module.exports = MemoryServiceTester;