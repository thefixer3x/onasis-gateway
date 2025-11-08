const EventEmitter = require('events');

/**
 * Metrics Collector - Comprehensive monitoring and metrics collection system
 */
class MetricsCollector extends EventEmitter {
  constructor() {
    super();
    this.prometheus = require('prom-client');
    this.register = new this.prometheus.Registry();
    this.metrics = {};
    this.customMetrics = new Map();
    this.alertRules = new Map();
    this.metricBuffer = [];
    this.bufferSize = 1000;
    
    this.initializeMetrics();
    this.startMetricsCollection();
  }

  /**
   * Initialize core metrics
   */
  initializeMetrics() {
    // Request metrics
    this.metrics.requestsTotal = new this.prometheus.Counter({
      name: 'api_requests_total',
      help: 'Total number of API requests',
      labelNames: ['service', 'endpoint', 'method', 'status_code', 'version'],
      registers: [this.register]
    });

    this.metrics.requestDuration = new this.prometheus.Histogram({
      name: 'api_request_duration_seconds',
      help: 'API request duration in seconds',
      labelNames: ['service', 'endpoint', 'method'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register]
    });

    // Error metrics
    this.metrics.errorsTotal = new this.prometheus.Counter({
      name: 'api_errors_total',
      help: 'Total number of API errors',
      labelNames: ['service', 'endpoint', 'error_type', 'error_code'],
      registers: [this.register]
    });

    this.metrics.errorRate = new this.prometheus.Gauge({
      name: 'api_error_rate',
      help: 'API error rate percentage',
      labelNames: ['service', 'endpoint'],
      registers: [this.register]
    });

    // Performance metrics
    this.metrics.responseSize = new this.prometheus.Histogram({
      name: 'api_response_size_bytes',
      help: 'API response size in bytes',
      labelNames: ['service', 'endpoint'],
      buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
      registers: [this.register]
    });

    this.metrics.concurrentRequests = new this.prometheus.Gauge({
      name: 'api_concurrent_requests',
      help: 'Number of concurrent API requests',
      labelNames: ['service'],
      registers: [this.register]
    });

    // Circuit breaker metrics
    this.metrics.circuitBreakerState = new this.prometheus.Gauge({
      name: 'circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
      labelNames: ['service', 'endpoint'],
      registers: [this.register]
    });

    this.metrics.circuitBreakerFailures = new this.prometheus.Counter({
      name: 'circuit_breaker_failures_total',
      help: 'Total circuit breaker failures',
      labelNames: ['service', 'endpoint'],
      registers: [this.register]
    });

    // Rate limiting metrics
    this.metrics.rateLimitHits = new this.prometheus.Counter({
      name: 'rate_limit_hits_total',
      help: 'Total rate limit hits',
      labelNames: ['service', 'endpoint', 'limit_type'],
      registers: [this.register]
    });

    this.metrics.rateLimitRemaining = new this.prometheus.Gauge({
      name: 'rate_limit_remaining',
      help: 'Remaining rate limit quota',
      labelNames: ['service', 'endpoint'],
      registers: [this.register]
    });

    // Authentication metrics
    this.metrics.authAttempts = new this.prometheus.Counter({
      name: 'auth_attempts_total',
      help: 'Total authentication attempts',
      labelNames: ['service', 'auth_type', 'result'],
      registers: [this.register]
    });

    this.metrics.tokenRefreshes = new this.prometheus.Counter({
      name: 'token_refreshes_total',
      help: 'Total token refreshes',
      labelNames: ['service', 'token_type'],
      registers: [this.register]
    });

    // Compliance metrics
    this.metrics.complianceViolations = new this.prometheus.Counter({
      name: 'compliance_violations_total',
      help: 'Total compliance violations',
      labelNames: ['service', 'regulation', 'violation_type'],
      registers: [this.register]
    });

    this.metrics.dataProcessingEvents = new this.prometheus.Counter({
      name: 'data_processing_events_total',
      help: 'Total data processing events',
      labelNames: ['service', 'operation', 'data_type'],
      registers: [this.register]
    });

    // Business metrics
    this.metrics.transactionVolume = new this.prometheus.Counter({
      name: 'transaction_volume_total',
      help: 'Total transaction volume',
      labelNames: ['service', 'currency', 'transaction_type'],
      registers: [this.register]
    });

    this.metrics.transactionValue = new this.prometheus.Counter({
      name: 'transaction_value_total',
      help: 'Total transaction value',
      labelNames: ['service', 'currency'],
      registers: [this.register]
    });

    // System health metrics
    this.metrics.serviceHealth = new this.prometheus.Gauge({
      name: 'service_health_status',
      help: 'Service health status (1=healthy, 0=unhealthy)',
      labelNames: ['service'],
      registers: [this.register]
    });

    this.metrics.dependencyHealth = new this.prometheus.Gauge({
      name: 'dependency_health_status',
      help: 'Dependency health status (1=healthy, 0=unhealthy)',
      labelNames: ['service', 'dependency'],
      registers: [this.register]
    });
  }

  /**
   * Record API request metrics
   */
  recordRequest(context) {
    const labels = {
      service: context.service,
      endpoint: context.endpoint,
      method: context.method,
      status_code: context.statusCode,
      version: context.version || 'unknown'
    };

    // Increment request counter
    this.metrics.requestsTotal.inc(labels);

    // Record duration
    if (context.duration) {
      this.metrics.requestDuration
        .labels(labels.service, labels.endpoint, labels.method)
        .observe(context.duration / 1000); // Convert to seconds
    }

    // Record response size
    if (context.responseSize) {
      this.metrics.responseSize
        .labels(labels.service, labels.endpoint)
        .observe(context.responseSize);
    }

    // Record error if applicable
    if (context.statusCode >= 400) {
      this.recordError({
        service: context.service,
        endpoint: context.endpoint,
        errorType: this.getErrorType(context.statusCode),
        errorCode: context.statusCode
      });
    }

    // Buffer for batch processing
    this.bufferMetric('request', context);

    // Emit event
    this.emit('metric:request', context);
  }

  /**
   * Record error metrics
   */
  recordError(context) {
    const labels = {
      service: context.service,
      endpoint: context.endpoint,
      error_type: context.errorType,
      error_code: context.errorCode
    };

    this.metrics.errorsTotal.inc(labels);

    // Calculate and update error rate
    this.updateErrorRate(context.service, context.endpoint);

    // Buffer for batch processing
    this.bufferMetric('error', context);

    // Emit event
    this.emit('metric:error', context);

    // Check alert rules
    this.checkAlertRules('error', context);
  }

  /**
   * Record circuit breaker metrics
   */
  recordCircuitBreaker(service, endpoint, state, failure = false) {
    const stateValue = { 'CLOSED': 0, 'OPEN': 1, 'HALF_OPEN': 2 }[state] || 0;
    
    this.metrics.circuitBreakerState
      .labels(service, endpoint)
      .set(stateValue);

    if (failure) {
      this.metrics.circuitBreakerFailures
        .labels(service, endpoint)
        .inc();
    }

    this.emit('metric:circuit_breaker', { service, endpoint, state, failure });
  }

  /**
   * Record rate limit metrics
   */
  recordRateLimit(service, endpoint, limitType, hit = false, remaining = null) {
    if (hit) {
      this.metrics.rateLimitHits
        .labels(service, endpoint, limitType)
        .inc();
    }

    if (remaining !== null) {
      this.metrics.rateLimitRemaining
        .labels(service, endpoint)
        .set(remaining);
    }

    this.emit('metric:rate_limit', { service, endpoint, limitType, hit, remaining });
  }

  /**
   * Record authentication metrics
   */
  recordAuthentication(service, authType, result, tokenType = null) {
    this.metrics.authAttempts
      .labels(service, authType, result)
      .inc();

    if (tokenType && result === 'refresh') {
      this.metrics.tokenRefreshes
        .labels(service, tokenType)
        .inc();
    }

    this.emit('metric:authentication', { service, authType, result, tokenType });
  }

  /**
   * Record compliance metrics
   */
  recordCompliance(service, regulation, violationType, dataType = null, operation = null) {
    if (violationType) {
      this.metrics.complianceViolations
        .labels(service, regulation, violationType)
        .inc();
    }

    if (dataType && operation) {
      this.metrics.dataProcessingEvents
        .labels(service, operation, dataType)
        .inc();
    }

    this.emit('metric:compliance', { service, regulation, violationType, dataType, operation });
  }

  /**
   * Record business transaction metrics
   */
  recordTransaction(service, currency, transactionType, value) {
    this.metrics.transactionVolume
      .labels(service, currency, transactionType)
      .inc();

    if (value) {
      this.metrics.transactionValue
        .labels(service, currency)
        .inc(parseFloat(value));
    }

    this.emit('metric:transaction', { service, currency, transactionType, value });
  }

  /**
   * Record service health metrics
   */
  recordServiceHealth(service, healthy, dependencies = {}) {
    this.metrics.serviceHealth
      .labels(service)
      .set(healthy ? 1 : 0);

    // Record dependency health
    for (const [dependency, dependencyHealthy] of Object.entries(dependencies)) {
      this.metrics.dependencyHealth
        .labels(service, dependency)
        .set(dependencyHealthy ? 1 : 0);
    }

    this.emit('metric:health', { service, healthy, dependencies });
  }

  /**
   * Record concurrent requests
   */
  recordConcurrentRequests(service, count) {
    this.metrics.concurrentRequests
      .labels(service)
      .set(count);
  }

  /**
   * Create custom metric
   */
  createCustomMetric(name, type, help, labelNames = []) {
    const MetricClass = this.prometheus[type];
    if (!MetricClass) {
      throw new Error(`Invalid metric type: ${type}`);
    }

    const metric = new MetricClass({
      name,
      help,
      labelNames,
      registers: [this.register]
    });

    this.customMetrics.set(name, metric);
    return metric;
  }

  /**
   * Get custom metric
   */
  getCustomMetric(name) {
    return this.customMetrics.get(name);
  }

  /**
   * Update error rate calculation
   */
  updateErrorRate(service, endpoint) {
    // This would typically be calculated from a time window
    // For now, we'll use a simplified approach
    const errorRate = this.calculateErrorRate(service, endpoint);
    this.metrics.errorRate
      .labels(service, endpoint)
      .set(errorRate);
  }

  /**
   * Calculate error rate for service/endpoint
   */
  calculateErrorRate(service, endpoint) {
    // Simplified calculation - in production, use time-series data
    const recentRequests = this.getRecentRequests(service, endpoint);
    const recentErrors = this.getRecentErrors(service, endpoint);
    
    if (recentRequests === 0) return 0;
    return (recentErrors / recentRequests) * 100;
  }

  /**
   * Get recent requests count (placeholder)
   */
  getRecentRequests(service, endpoint) {
    // In production, query time-series database
    return 100; // Placeholder
  }

  /**
   * Get recent errors count (placeholder)
   */
  getRecentErrors(service, endpoint) {
    // In production, query time-series database
    return 5; // Placeholder
  }

  /**
   * Get error type from status code
   */
  getErrorType(statusCode) {
    if (statusCode >= 400 && statusCode < 500) return 'client_error';
    if (statusCode >= 500) return 'server_error';
    return 'unknown_error';
  }

  /**
   * Buffer metric for batch processing
   */
  bufferMetric(type, data) {
    this.metricBuffer.push({
      type,
      data,
      timestamp: Date.now()
    });

    // Flush buffer if it's full
    if (this.metricBuffer.length >= this.bufferSize) {
      this.flushMetricBuffer();
    }
  }

  /**
   * Flush metric buffer
   */
  flushMetricBuffer() {
    if (this.metricBuffer.length === 0) return;

    const batch = [...this.metricBuffer];
    this.metricBuffer = [];

    // Process batch asynchronously
    setImmediate(() => {
      this.processBatch(batch);
    });
  }

  /**
   * Process metric batch
   */
  processBatch(batch) {
    // Group by type for efficient processing
    const grouped = batch.reduce((acc, item) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item);
      return acc;
    }, {});

    // Process each type
    for (const [type, items] of Object.entries(grouped)) {
      this.processBatchType(type, items);
    }

    this.emit('batch:processed', { size: batch.length, types: Object.keys(grouped) });
  }

  /**
   * Process batch by type
   */
  processBatchType(type, items) {
    switch (type) {
      case 'request':
        this.processRequestBatch(items);
        break;
      case 'error':
        this.processErrorBatch(items);
        break;
      default:
        console.warn(`Unknown batch type: ${type}`);
    }
  }

  /**
   * Process request batch
   */
  processRequestBatch(items) {
    // Aggregate request data for analytics
    const aggregated = items.reduce((acc, item) => {
      const key = `${item.data.service}:${item.data.endpoint}`;
      if (!acc[key]) {
        acc[key] = {
          count: 0,
          totalDuration: 0,
          totalSize: 0,
          statusCodes: {}
        };
      }
      
      acc[key].count++;
      acc[key].totalDuration += item.data.duration || 0;
      acc[key].totalSize += item.data.responseSize || 0;
      
      const status = item.data.statusCode;
      acc[key].statusCodes[status] = (acc[key].statusCodes[status] || 0) + 1;
      
      return acc;
    }, {});

    // Emit aggregated data
    this.emit('batch:requests', aggregated);
  }

  /**
   * Process error batch
   */
  processErrorBatch(items) {
    // Aggregate error data
    const aggregated = items.reduce((acc, item) => {
      const key = `${item.data.service}:${item.data.endpoint}`;
      if (!acc[key]) {
        acc[key] = {
          count: 0,
          errorTypes: {}
        };
      }
      
      acc[key].count++;
      const errorType = item.data.errorType;
      acc[key].errorTypes[errorType] = (acc[key].errorTypes[errorType] || 0) + 1;
      
      return acc;
    }, {});

    // Emit aggregated data
    this.emit('batch:errors', aggregated);
  }

  /**
   * Add alert rule
   */
  addAlertRule(name, condition, action) {
    this.alertRules.set(name, { condition, action });
  }

  /**
   * Check alert rules
   */
  checkAlertRules(metricType, data) {
    for (const [name, rule] of this.alertRules.entries()) {
      try {
        if (rule.condition(metricType, data)) {
          rule.action(name, metricType, data);
        }
      } catch (error) {
        console.error(`Alert rule ${name} failed:`, error);
      }
    }
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    // Flush buffer periodically
    setInterval(() => {
      this.flushMetricBuffer();
    }, 5000); // Every 5 seconds

    // Collect default metrics
    this.prometheus.collectDefaultMetrics({ register: this.register });
  }

  /**
   * Get metrics for Prometheus scraping
   */
  getMetrics() {
    return this.register.metrics();
  }

  /**
   * Get metric summary
   */
  getMetricSummary() {
    return {
      totalMetrics: this.register.getSingleMetric ? 
        Object.keys(this.register.getSingleMetric()).length : 0,
      customMetrics: this.customMetrics.size,
      bufferSize: this.metricBuffer.length,
      alertRules: this.alertRules.size
    };
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.register.resetMetrics();
    this.metricBuffer = [];
    this.emit('metrics:reset');
  }

  /**
   * Export metrics to external system
   */
  async exportMetrics(exporter) {
    const metrics = await this.getMetrics();
    return exporter.export(metrics);
  }
}

module.exports = MetricsCollector;
