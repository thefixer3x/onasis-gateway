---
name: version-manager
description: "Guardrails for edits to core/versioning/version-manager.js covering semver validation, deprecation, migrations, and compatibility rules. Use when changing version registration or migration handling."
---

# Skill: Version Manager Guardian

## Purpose & Scope

This skill applies when modifying the **Version Manager** (`core/versioning/version-manager.js`).

The Version Manager provides:
- Semantic versioning enforcement
- Version compatibility analysis
- Migration handler registration and execution
- Version deprecation management
- Breaking change detection
- Compatibility matrix tracking

## Critical Rules - NEVER Do

### Version Lifecycle
- **NEVER** delete versions without deprecation period (minimum 30 days)
- **NEVER** skip the deprecation phase for any version
- **NEVER** remove versions that are still in active use
- **NEVER** change version registration timestamps retroactively

### Semver Compliance
- **NEVER** mark breaking changes as compatible
- **NEVER** skip major version bump for breaking changes
- **NEVER** allow non-semver version formats
- **NEVER** bypass semver validation

### Breaking Changes Classification
- **NEVER** allow these changes in minor/patch versions:
  - Removing endpoints
  - Adding required parameters
  - Changing parameter types
  - Modifying authentication requirements
  - Changing response structure

### Migration Safety
- **NEVER** skip version compatibility analysis
- **NEVER** allow migrations without registered handlers
- **NEVER** execute migrations without rollback capability
- **NEVER** bypass migration validation

### Compatibility Matrix
- **NEVER** delete compatibility matrix entries
- **NEVER** falsify compatibility status
- **NEVER** hide breaking changes in compatibility reports

## Required Patterns - MUST Follow

### Semver Validation
```javascript
// MUST validate version format before registration
registerVersion(serviceId, version, config) {
    if (!semver.valid(version)) {
        throw new Error(`Invalid version format: ${version}`);
    }
    // Continue with registration
}
```

### Breaking Change Detection
```javascript
// MUST detect these as breaking changes:
const breakingChangeTypes = [
    'endpoint_removed',
    'method_changed',
    'path_changed',
    'required_parameter_added',
    'required_parameter_removed',
    'parameter_type_changed',
    'auth_type_changed',
    'baseUrl_changed'
];

// Compatibility MUST be false if any breaking changes exist
compatibility.compatible = compatibility.breakingChanges.length === 0;
```

### Version Registration
```javascript
// MUST include metadata on registration
this.supportedVersions.set(key, {
    ...config,
    registeredAt: new Date(),
    deprecated: false
});

// MUST create compatibility mappings
this.createCompatibilityMappings(serviceId, version, config);

// MUST emit registration event
this.emit('version:registered', { serviceId, version, config });
```

### Deprecation Process
```javascript
// MUST follow deprecation protocol
deprecateVersion(serviceId, version, reason) {
    config.deprecated = true;
    config.deprecationReason = reason;
    config.deprecatedAt = new Date();

    this.emit('version:deprecated', { serviceId, version, reason });
}
```

### Migration Handler Registration
```javascript
// MUST register handlers for version transitions
registerMigrationHandler(serviceId, fromVersion, toVersion, handler) {
    const key = `${serviceId}:${fromVersion}->${toVersion}`;
    this.migrationHandlers.set(key, handler);
}
```

### Event Emission
```javascript
// MUST emit events for version lifecycle
this.emit('version:registered', { serviceId, version, config });
this.emit('version:deprecated', { serviceId, version, reason });
this.emit('migration:completed', { serviceId, fromVersion, toVersion, data });
this.emit('migration:failed', { serviceId, fromVersion, toVersion, error });
```

## Version Deprecation Timeline

```
Day 0:    Mark as deprecated, emit 'version:deprecated' event
Day 1-7:  Log warnings for all requests using deprecated version
Day 8-14: Return deprecation headers in responses
Day 15-29: Increase warning severity
Day 30+:  Safe to remove (after migration verification)
```

## Breaking Change Reference

| Change Type | Severity | Version Bump | Migration Required |
|-------------|----------|--------------|-------------------|
| Endpoint removed | BREAKING | Major | Yes |
| Method changed | BREAKING | Major | Yes |
| Path changed | BREAKING | Major | Yes |
| Required param added | BREAKING | Major | Yes |
| Required param removed | BREAKING | Major | Yes |
| Param type changed | BREAKING | Major | Yes |
| Auth type changed | BREAKING | Major | Yes |
| Optional param added | Compatible | Minor | No |
| New endpoint added | Compatible | Minor | No |
| Bug fix | Compatible | Patch | No |

## Version Status Lifecycle

```
REGISTERED -> ACTIVE -> DEPRECATED -> REMOVED
     ^           |
     +-----------+ (rollback possible before deprecation)
```

- **REGISTERED**: Version exists but may not be in use
- **ACTIVE**: Version is in production use
- **DEPRECATED**: Marked for removal, deprecation period started
- **REMOVED**: Version no longer supported (30+ days after deprecation)

## Integration Points

| Component | Integration Method |
|-----------|-------------------|
| Base Client | Version passed in request options |
| Metrics Collector | Version label in request metrics |
| REST API | `/v{version}/` path prefix |
| MCP Server | Version header in tool calls |
| Vendor Abstraction | Version-specific vendor mappings |
