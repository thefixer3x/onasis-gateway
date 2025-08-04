#!/usr/bin/env node

/**
 * Memory as a Service Webhooks Handler
 * Processes webhook events from Memory service
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class MemoryWebhooksHandler extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.serviceName = 'memory-as-a-service';
    this.webhookSecret = config.webhookSecret || process.env.MEMORY_WEBHOOK_SECRET;
    this.enabledEvents = config.enabledEvents || [
      'memory.created',
      'memory.updated',
      'memory.deleted',
      'memory.bulk_deleted',
      'topic.created',
      'user.stats_updated'
    ];
    
    this.setupEventListeners();
  }

  /**
   * Setup internal event listeners
   */
  setupEventListeners() {
    // Memory lifecycle events
    this.on('memory.created', this.handleMemoryCreated.bind(this));
    this.on('memory.updated', this.handleMemoryUpdated.bind(this));
    this.on('memory.deleted', this.handleMemoryDeleted.bind(this));
    this.on('memory.bulk_deleted', this.handleBulkMemoryDeleted.bind(this));
    
    // Topic events
    this.on('topic.created', this.handleTopicCreated.bind(this));
    
    // Analytics events
    this.on('user.stats_updated', this.handleStatsUpdated.bind(this));
  }

  /**
   * Main webhook handler for HTTP requests
   */
  async handleWebhook(req, res) {
    try {
      // Verify webhook signature
      if (this.webhookSecret && !this.verifySignature(req)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      const { event_type, data, timestamp, user_id } = req.body;

      // Validate required fields
      if (!event_type || !data) {
        return res.status(400).json({ error: 'Missing required webhook fields' });
      }

      // Check if event is enabled
      if (!this.enabledEvents.includes(event_type)) {
        console.log(`Webhook event '${event_type}' is not enabled, skipping...`);
        return res.status(200).json({ message: 'Event not enabled' });
      }

      console.log(`📨 Processing Memory webhook: ${event_type}`);
      
      // Emit internal event
      this.emit(event_type, {
        ...data,
        user_id,
        timestamp: timestamp || new Date().toISOString(),
        source: 'webhook'
      });

      // Process webhook based on event type
      await this.processWebhookEvent(event_type, data, user_id);

      res.status(200).json({ 
        success: true, 
        message: 'Webhook processed successfully',
        event_type,
        processed_at: new Date().toISOString()
      });

    } catch (error) {
      console.error('Memory webhook processing error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Verify webhook signature using HMAC
   */
  verifySignature(req) {
    try {
      const signature = req.headers['x-memory-signature'] || req.headers['x-hub-signature-256'];
      if (!signature) return false;

      const body = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(body)
        .digest('hex');

      const actualSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(actualSignature)
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Process webhook events and trigger appropriate actions
   */
  async processWebhookEvent(eventType, data, userId) {
    switch (eventType) {
      case 'memory.created':
        await this.processMemoryCreated(data, userId);
        break;
        
      case 'memory.updated':
        await this.processMemoryUpdated(data, userId);
        break;
        
      case 'memory.deleted':
        await this.processMemoryDeleted(data, userId);
        break;
        
      case 'memory.bulk_deleted':
        await this.processBulkMemoryDeleted(data, userId);
        break;
        
      case 'topic.created':
        await this.processTopicCreated(data, userId);
        break;
        
      case 'user.stats_updated':
        await this.processStatsUpdated(data, userId);
        break;
        
      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }
  }

  /**
   * Handle memory creation events
   */
  async handleMemoryCreated(data) {
    console.log(`📝 New memory created: ${data.memory_id} (${data.memory_type})`);
    
    // Update user statistics
    await this.updateUserStats(data.user_id, 'memory_created');
    
    // Trigger real-time notifications
    this.emit('notification', {
      type: 'memory_created',
      user_id: data.user_id,
      message: `New ${data.memory_type} memory created`,
      data: {
        memory_id: data.memory_id,
        title: data.title || 'Untitled Memory'
      }
    });
  }

  /**
   * Handle memory update events
   */
  async handleMemoryUpdated(data) {
    console.log(`📝 Memory updated: ${data.memory_id}`);
    
    // Track memory versions for audit trail
    await this.createMemoryVersion(data.memory_id, data.changes);
    
    // Trigger real-time notifications
    this.emit('notification', {
      type: 'memory_updated',
      user_id: data.user_id,
      message: 'Memory updated successfully',
      data: {
        memory_id: data.memory_id,
        changes: data.changes
      }
    });
  }

  /**
   * Handle memory deletion events (GDPR compliance)
   */
  async handleMemoryDeleted(data) {
    console.log(`🗑️ Memory deleted: ${data.memory_id}`);
    
    // Update user statistics
    await this.updateUserStats(data.user_id, 'memory_deleted');
    
    // Create deletion audit log
    await this.createDeletionAuditLog(data.memory_id, data.user_id);
    
    // Trigger real-time notifications
    this.emit('notification', {
      type: 'memory_deleted',
      user_id: data.user_id,
      message: 'Memory deleted successfully',
      data: {
        memory_id: data.memory_id
      }
    });
  }

  /**
   * Handle bulk deletion events
   */
  async handleBulkMemoryDeleted(data) {
    console.log(`🗑️ Bulk deletion: ${data.deleted_count} memories deleted`);
    
    // Update user statistics
    await this.updateUserStats(data.user_id, 'bulk_memory_deleted', data.deleted_count);
    
    // Create bulk deletion audit log
    await this.createBulkDeletionAuditLog(data.memory_ids, data.user_id);
    
    // Trigger real-time notifications
    this.emit('notification', {
      type: 'memory_bulk_deleted',
      user_id: data.user_id,
      message: `${data.deleted_count} memories deleted successfully`,
      data: {
        deleted_count: data.deleted_count,
        failed_count: data.failed_ids?.length || 0
      }
    });
  }

  /**
   * Handle topic creation events
   */
  async handleTopicCreated(data) {
    console.log(`📂 New topic created: ${data.topic_id} (${data.name})`);
    
    // Update user statistics
    await this.updateUserStats(data.user_id, 'topic_created');
    
    // Trigger real-time notifications
    this.emit('notification', {
      type: 'topic_created',
      user_id: data.user_id,
      message: `New topic "${data.name}" created`,
      data: {
        topic_id: data.topic_id,
        name: data.name
      }
    });
  }

  /**
   * Handle user statistics updates
   */
  async handleStatsUpdated(data) {
    console.log(`📊 User stats updated: ${data.user_id}`);
    
    // Trigger real-time notifications for dashboard updates
    this.emit('notification', {
      type: 'stats_updated',
      user_id: data.user_id,
      message: 'Statistics updated',
      data: data.stats
    });
  }

  /**
   * Process individual webhook events
   */
  async processMemoryCreated(data, userId) {
    // Send to analytics
    this.trackAnalytics('memory_created', {
      user_id: userId,
      memory_type: data.memory_type,
      content_length: data.content?.length || 0,
      tags_count: data.tags?.length || 0
    });

    // Check for content moderation if enabled
    if (process.env.ENABLE_CONTENT_MODERATION === 'true') {
      await this.moderateContent(data.memory_id, data.content);
    }
  }

  async processMemoryUpdated(data, userId) {
    // Track update analytics
    this.trackAnalytics('memory_updated', {
      user_id: userId,
      memory_id: data.memory_id,
      changes_count: data.changes?.length || 0
    });
  }

  async processMemoryDeleted(data, userId) {
    // Track deletion analytics
    this.trackAnalytics('memory_deleted', {
      user_id: userId,
      memory_id: data.memory_id
    });
  }

  async processBulkMemoryDeleted(data, userId) {
    // Track bulk deletion analytics
    this.trackAnalytics('memory_bulk_deleted', {
      user_id: userId,
      deleted_count: data.deleted_count,
      failed_count: data.failed_ids?.length || 0
    });
  }

  async processTopicCreated(data, userId) {
    // Track topic creation analytics
    this.trackAnalytics('topic_created', {
      user_id: userId,
      topic_name: data.name
    });
  }

  async processStatsUpdated(data, userId) {
    // Update dashboard cache
    this.emit('dashboard_update', {
      user_id: userId,
      stats: data.stats
    });
  }

  /**
   * Helper methods
   */
  async updateUserStats(userId, action, count = 1) {
    // Implementation would update user statistics in database
    console.log(`Updating user stats: ${userId} - ${action} (${count})`);
  }

  async createMemoryVersion(memoryId, changes) {
    // Implementation would create version record for audit trail
    console.log(`Creating memory version: ${memoryId}`, changes);
  }

  async createDeletionAuditLog(memoryId, userId) {
    // Implementation would create GDPR-compliant deletion log
    console.log(`Creating deletion audit log: ${memoryId} for user ${userId}`);
  }

  async createBulkDeletionAuditLog(memoryIds, userId) {
    // Implementation would create bulk deletion audit log
    console.log(`Creating bulk deletion audit log: ${memoryIds.length} memories for user ${userId}`);
  }

  async moderateContent(memoryId, content) {
    // Implementation would check content for policy violations
    console.log(`Moderating content for memory: ${memoryId}`);
  }

  trackAnalytics(event, data) {
    // Send to analytics service
    this.emit('analytics', {
      event,
      data,
      timestamp: new Date().toISOString(),
      service: this.serviceName
    });
  }

  /**
   * Get webhook configuration
   */
  getWebhookConfig() {
    return {
      service: this.serviceName,
      enabled_events: this.enabledEvents,
      signature_verification: !!this.webhookSecret,
      supported_events: [
        'memory.created',
        'memory.updated', 
        'memory.deleted',
        'memory.bulk_deleted',
        'topic.created',
        'user.stats_updated'
      ]
    };
  }
}

module.exports = MemoryWebhooksHandler;