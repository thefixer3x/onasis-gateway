# Version Manager Hardening

## Overview

This document describes the hardening enhancements made to the Version Manager component in the LanOnasis Gateway project.

## Changes Implemented

### 1. Migration Rollback Support

The Version Manager now supports full migration rollback capabilities:

#### Snapshot-Based Rollback
- Before any migration executes, a JSON snapshot of the current data state is automatically created
- Snapshots include: serviceId, fromVersion, toVersion, data, timestamp, and unique snapshot ID
- Snapshots are stored in-memory and can be retrieved for debugging or manual restoration

#### Explicit Rollback Handlers
- New `registerRollbackHandler()` method allows registering custom rollback logic
- Rollback handlers receive the original data and the migration error
- Handler returns the rolled-back data state

#### Automatic Rollback on Failure
- If a migration fails, the system automatically attempts rollback
- Priority: explicit rollback handler → snapshot restoration → emit failure event
- Rollback is attempted even if the rollback handler itself fails (with degradation reporting)

### 2. Event System Enhancements

New events emitted by the Version Manager:

| Event | Description |
|-------|-------------|
| `migration:completed` | Migration executed successfully |
| `migration:failed` | Migration threw an error |
| `migration:rolled_back` | Rollback completed successfully |
| `migration:rollback_failed` | Rollback could not be completed |

#### Event Payloads

**migration:completed**
```javascript
{
  serviceId: string,
  fromVersion: string,
  toVersion: string,
  data: any,        // Migrated data
  snapshotId: string // ID of pre-migration snapshot
}
```

**migration:rolled_back**
```javascript
{
  serviceId: string,
  fromVersion: string,
  toVersion: string,
  originalData: any,
  rolledBackData: any,
  originalError: string,
  snapshotId: string
}
```

**migration:rollback_failed**
```javascript
{
  serviceId: string,
  fromVersion: string,
  toVersion: string,
  error: Error,
  rollbackError?: string,  // If rollback handler also failed
  reason?: string          // If no rollback mechanism available
}
```

### 3. Base URL Field Renaming

The `baseUrl` field has been renamed to `baseUrl_changed` in compatibility analysis:

**Before:**
```javascript
if (newConfig.baseUrl !== oldConfig.baseUrl) {
  breakingChanges.push({ type: 'baseUrl', ... });
}
```

**After:**
```javascript
if (newConfig.baseUrl_changed !== oldConfig.baseUrl_changed) {
  breakingChanges.push({ type: 'baseUrl_changed', ... });
}
```

This provides clearer semantic meaning when detecting breaking changes.

## API Reference

### New Methods

```javascript
// Register a rollback handler
versionManager.registerRollbackHandler(serviceId, fromVersion, toVersion, async (data, error) => {
  // Custom rollback logic
  return rolledBackData;
});

// Create manual snapshot
const snapshot = versionManager.createMigrationSnapshot(serviceId, fromVersion, toVersion, data);

// Get snapshot
const snapshot = versionManager.getSnapshot(serviceId, fromVersion, toVersion);

// Get all snapshots
const allSnapshots = versionManager.getAllSnapshots();

// Clear snapshots
versionManager.clearSnapshots(serviceId, fromVersion, toVersion);
```

### Updated Methods

```javascript
// executeMigration now includes rollback support
const result = await versionManager.executeMigration(serviceId, fromVersion, toVersion, data);
```

## Usage Example

```javascript
const VersionManager = require('./core/versioning/version-manager');

const vm = new VersionManager();

// Register service versions
vm.registerVersion('user-service', '1.0.0', {
  endpoints: [...],
  baseUrl_changed: 'https://api.example.com/v1'
});

vm.registerVersion('user-service', '2.0.0', {
  endpoints: [...],
  baseUrl_changed: 'https://api.example.com/v2'
});

// Register migration with rollback
vm.registerMigrationHandler('user-service', '1.0.0', '2.0.0', async (data) => {
  // Transform data to v2 format
  return transformToV2(data);
});

vm.registerRollbackHandler('user-service', '1.0.0', '2.0.0', async (data, error) => {
  console.log('Migration failed:', error.message);
  // Restore v1 format
  return restoreToV1(data);
});

// Listen for events
vm.on('migration:rolled_back', (event) => {
  console.log('Rollback completed:', event);
});

// Execute migration (automatic rollback on failure)
try {
  const migratedData = await vm.executeMigration('user-service', '1.0.0', '2.0.0', currentData);
  console.log('Migration successful:', migratedData);
} catch (error) {
  console.log('Migration failed and rollback was attempted');
}
```

## Testing

A comprehensive test suite is provided in `tests/core/version-manager.test.js` covering:

- Version registration and retrieval
- Semver comparison and latest version detection
- Base URL change detection
- Migration execution
- Snapshot creation and retrieval
- Rollback handler registration
- Automatic rollback on migration failure
- Event emission for all migration states

Run tests with:
```bash
npm test -- tests/core/version-manager.test.js
```

## Migration Guide

### Updating Existing Code

1. **If you use `baseUrl` in service configs**, rename to `baseUrl_changed`
2. **If you listen for migration events**, add handlers for `migration:rolled_back` and `migration:rollback_failed`
3. **Optional**: Register rollback handlers for critical migrations

### Backward Compatibility

- The Version Manager maintains backward compatibility with existing migration handlers
- Snapshot creation is automatic and non-breaking
- Event listeners for existing events continue to work

## Security Considerations

- Snapshots contain a copy of data in memory; ensure adequate memory for large datasets
- Rollback handlers receive error objects; sanitize error data before logging
- Consider encrypting sensitive data in snapshots for high-security environments

## Performance Impact

- Snapshot creation adds minimal overhead (JSON serialization)
- Memory usage increases proportionally to migration data size
- Snapshots can be cleared after successful migration to free memory
