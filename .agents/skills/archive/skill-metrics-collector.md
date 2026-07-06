---
name: metrics-collector-guardian
description: Guardrails for edits to core/monitoring/metrics-collector.js to preserve Prometheus metric names, labels, cardinality limits, and emission patterns. Use when adding or changing metrics or collectors.
---

# Skill: Metrics Collector Guardian

## Purpose & Scope

This skill applies when modifying the **Metrics Collector** (`core/monitoring/metrics-collector.js`).

The Metrics Collector provides:
- Prometheus-compatible metrics collection
- Request/response/error tracking
- Circuit breaker state monitoring
- Rate limiting metrics
- Business transaction metrics
- Alert rule management
- Metric buffering and batch processing

## Critical Rules - NEVER Do

### Metric Names
- **NEVER** remove or rename existing Prometheus metric names:
  - `api_requests_total`
  - `api_request_duration_seconds`
  - `api_errors_total`
  - `api_error_rate`
  - `api_response_size_bytes`
  - `api_concurrent_requests`
  - `circuit_breaker_state`
  - `circuit_breaker_failures_total`
  - `rate_limit_hits_total`
  - `rate_limit_remaining`
  - `auth_attempts_total`
  - `token_refreshes_total`
  - `compliance_violations_total`
  - `data_processing_events_total`
  - `transaction_volume_total`
  - `transaction_value_total`
  - `service_health_status`
  - `dependency_health_status`

### Label Stability
- **NEVER** remove or rename labels on existing metrics
- **NEVER** add new required labels to existing metrics (breaks dashboards)
- **NEVER** change label value formats (e.g., `200` vs `"200"`)

### Cardinality
- **NEVER** create unbounded cardinality labels:
  - No `transaction_id` labels (unique per request)
  - No `user_id` labels (high cardinality)
  - No `request_id` labels (unique per request)
  - No `timestamp` labels (infinite values)

### PII in Metrics
- **NEVER** put PII in metric labels:
  - No email addresses
  - No user names
  - No IP addresses (unless explicitly required)
  - No account numbers

### Histogram Buckets
- **NEVER** change existing histogram bucket boundaries
- Duration buckets: `[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30]`
- Size buckets: `[100, 1000, 10000, 100000, 1000000, 10000000]`

## Required Patterns - MUST Follow

### Metric Registration
```javascript
// MUST register with proper name, help, labelNames
this.metrics.metricName = new this.prometheus.Counter({
    name: 'metric_name_total',
    help: 'Clear description of what this metric measures',
    labelNames: ['service', 'endpoint', 'method'],
    registers: [this.register]
});
```

### Event Emission After Recording
```javascript
// MUST emit events after recording metrics
recordRequest(context) {
    this.metrics.requestsTotal.inc(labels);
    this.emit('metric:request', context);  // REQUIRED
}
```

### Label Value Consistency
```javascript
// MUST use consistent label values
const labels = {
    service: context.service,        // lowercase, snake_case
    endpoint: context.endpoint,      // /path/to/endpoint format
    method: context.method,          // uppercase: GET, POST, etc.
    status_code: context.statusCode  // numeric as string
};
```

### Error Type Classification
```javascript
// MUST use standard error type classification
getErrorType(statusCode) {
    if (statusCode >= 400 && statusCode < 500) return 'client_error';
    if (statusCode >= 500) return 'server_error';
    return 'unknown_error';
}
```

### Circuit Breaker State Values
```javascript
// MUST use numeric state values for Prometheus
const stateValue = { 'CLOSED': 0, 'OPEN': 1, 'HALF_OPEN': 2 }[state] || 0;
```

## Safe Modification Examples

### Adding a New Counter Metric
```javascript
// Add in initializeMetrics()
this.metrics.newMetric = new this.prometheus.Counter({
    name: 'onasis_new_metric_total',  // Use prefix for namespacing
    help: 'Description of what this measures',
    labelNames: ['service', 'type'],   // Keep labels bounded
    registers: [this.register]
});

// Add recording method
recordNewMetric(service, type) {
    this.metrics.newMetric.labels(service, type).inc();
    this.emit('metric:new_metric', { service, type });
}
```

### Adding a New Histogram Metric
```javascript
// Use standard bucket sizes
this.metrics.newHistogram = new this.prometheus.Histogram({
    name: 'onasis_new_histogram_seconds',
    help: 'Description',
    labelNames: ['service', 'operation'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    registers: [this.register]
});
```

### Adding a New Gauge Metric
```javascript
this.metrics.newGauge = new this.prometheus.Gauge({
    name: 'onasis_new_gauge',
    help: 'Current value of something',
    labelNames: ['service'],
    registers: [this.register]
});

// Set value
this.metrics.newGauge.labels('my-service').set(42);
```

### Adding a New Alert Rule
```javascript
this.addAlertRule('high-error-rate',
    (type, data) => {
        return type === 'error' && data.errorRate > 10;
    },
    (name, type, data) => {
        console.error(`Alert ${name}: Error rate ${data.errorRate}%`);
        this.emit('alert:triggered', { name, type, data });
    }
);
```

## Integration Points

| Component | Integration Method |
|-----------|-------------------|
| Base Client | Emits `request`, `response`, `error` events |
| Compliance Manager | Records compliance violations |
| Version Manager | Version label in request metrics |
| Prometheus | `getMetrics()` endpoint for scraping |
| Grafana | Query metrics via PromQL |

## Metric Export Format

```
# HELP api_requests_total Total number of API requests
# TYPE api_requests_total counter
api_requests_total{service="stripe-api",endpoint="/v1/charges",method="POST",status_code="200",version="v1"} 1523

# HELP api_request_duration_seconds API request duration in seconds
# TYPE api_request_duration_seconds histogram
api_request_duration_seconds_bucket{service="stripe-api",endpoint="/v1/charges",method="POST",le="0.1"} 1200
api_request_duration_seconds_bucket{service="stripe-api",endpoint="/v1/charges",method="POST",le="0.5"} 1450
```

## Testing Requirements

Before any changes to this file:

```bash
# 1. Run metrics tests
npm test -- --grep "MetricsCollector"

# 2. Verify metric registration
node -e "
const MC = require('./core/monitoring/metrics-collector');
const mc = new MC();
console.log('Metrics registered:', Object.keys(mc.metrics).length);
"

# 3. Test Prometheus output format
node -e "
const MC = require('./core/monitoring/metrics-collector');
const mc = new MC();
mc.getMetrics().then(m => console.log(m.substring(0, 500)));
"

# 4. Verify event emission
const mc = new MetricsCollector();
mc.on('metric:request', (data) => console.log('Event received:', data));
mc.recordRequest({ service: 'test', endpoint: '/test', method: 'GET', statusCode: 200 });
```

## Rollback Procedure

If changes cause issues:

1. **Immediate Rollback**
   ```bash
   git checkout HEAD~1 -- core/monitoring/metrics-collector.js
   ```

2. **Verify Metrics**
   ```bash
   curl http://localhost:3001/metrics | head -50
   ```

3. **Check Grafana Dashboards**
   - Verify all panels still loading
   - Check for "No data" errors
   - Verify label filters still work

4. **Alert Rule Check**
   ```javascript
   const mc = new MetricsCollector();
   console.log('Alert rules:', mc.alertRules.size);
   ```

## Cardinality Guidelines

| Label | Acceptable Values | Max Cardinality |
|-------|-------------------|-----------------|
| service | Service names | ~50 |
| endpoint | API paths | ~200 per service |
| method | GET, POST, PUT, DELETE, PATCH | 5 |
| status_code | HTTP status codes | ~20 |
| error_type | client_error, server_error, unknown_error | 3 |
| auth_type | bearer, apikey, basic, hmac, oauth2 | 5 |
| regulation | PCI_DSS, GDPR, PSD2, SOX, HIPAA | 5 |

**Total expected cardinality per metric**: < 10,000 unique label combinations
