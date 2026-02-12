---
name: metrics-collector
description: Guardrails for edits to core/monitoring/metrics-collector.js to preserve Prometheus metric names, labels, cardinality limits, and emission patterns. Use when adding or changing metrics or collectors.
---

# Metrics Collector Guardian

## Purpose & Scope

Apply this skill when modifying `core/monitoring/metrics-collector.js`.

The Metrics Collector provides:
- Prometheus-compatible metrics collection
- Request/response/error tracking
- Circuit breaker state monitoring
- Rate limiting metrics
- Business transaction metrics
- Alert rule management
- Metric buffering and batch processing

## Non-Negotiables (Never Do)

### Metric Names
- Never remove or rename existing Prometheus metric names:
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
- Never remove or rename labels on existing metrics.
- Never add new required labels to existing metrics.
- Never change label value formats (for example, `200` vs `"200"`).

### Cardinality
- Never create unbounded cardinality labels:
  - No `transaction_id` labels.
  - No `user_id` labels.
  - No `request_id` labels.
  - No `timestamp` labels.

### PII in Metrics
- Never put PII in metric labels:
  - No email addresses.
  - No user names.
  - No IP addresses (unless explicitly required).
  - No account numbers.

### Histogram Buckets
- Never change existing histogram bucket boundaries.
- Duration buckets: `[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30]`
- Size buckets: `[100, 1000, 10000, 100000, 1000000, 10000000]`

## Required Patterns (Must Follow)

### Metric Registration
```javascript
// Must register with proper name, help, labelNames
this.metrics.metricName = new this.prometheus.Counter({
    name: 'metric_name_total',
    help: 'Clear description of what this metric measures',
    labelNames: ['service', 'endpoint', 'method'],
    registers: [this.register]
});
```

### Event Emission After Recording
```javascript
// Must emit events after recording metrics
recordRequest(context) {
    this.metrics.requestsTotal.inc(labels);
    this.emit('metric:request', context);
}
```

### Label Value Consistency
```javascript
// Must use consistent label values
const labels = {
    service: context.service,        // lowercase, snake_case
    endpoint: context.endpoint,      // /path/to/endpoint format
    method: context.method,          // uppercase: GET, POST, etc.
    status_code: context.statusCode  // numeric as string
};
```

### Error Type Classification
```javascript
// Must use standard error type classification
getErrorType(statusCode) {
    if (statusCode >= 400 && statusCode < 500) return 'client_error';
    if (statusCode >= 500) return 'server_error';
    return 'unknown_error';
}
```

### Circuit Breaker State Values
```javascript
// Must use numeric state values for Prometheus
const stateValue = { 'CLOSED': 0, 'OPEN': 1, 'HALF_OPEN': 2 }[state] || 0;
```

## Safe Modification Examples

### Adding a New Counter Metric
```javascript
// Add in initializeMetrics()
this.metrics.newMetric = new this.prometheus.Counter({
    name: 'onasis_new_metric_total',
    help: 'Description of what this measures',
    labelNames: ['service', 'type'],
    registers: [this.register]
});

recordNewMetric(service, type) {
    this.metrics.newMetric.labels(service, type).inc();
    this.emit('metric:new_metric', { service, type });
}
```

### Adding a New Histogram Metric
```javascript
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

this.metrics.newGauge.labels('my-service').set(42);
```

## Integration Points

| Component | Integration Method |
|-----------|-------------------|
| Base Client | Emits `request`, `response`, `error` events |
| Compliance Manager | Records compliance violations |
| Version Manager | Version label in request metrics |
| Prometheus | `getMetrics()` endpoint for scraping |
| Grafana | Query metrics via PromQL |

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

## Testing Requirements

Run these checks before shipping changes:
```bash
npm test -- --grep "MetricsCollector"
node -e "const MC = require('./core/monitoring/metrics-collector'); const mc = new MC(); console.log('Metrics registered:', Object.keys(mc.metrics).length);"
node -e "const MC = require('./core/monitoring/metrics-collector'); const mc = new MC(); mc.getMetrics().then(m => console.log(m.substring(0, 500)));"
```
