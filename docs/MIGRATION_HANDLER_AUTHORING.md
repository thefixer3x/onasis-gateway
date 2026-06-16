# Migration Handler Authoring Guide

This guide explains how to author migration handlers and rollback handlers for the Version Manager in the Lan Onasis Gateway.

## Overview

Migration handlers transform data when a service upgrades from one version to another. Rollback handlers restore data if a migration fails.

```
┌─────────────┐     migration      ┌─────────────┐
│  v1.0.0     │ ─────────────────► │  v2.0.0     │
│             │ ◄───────────────── │             │
└─────────────┘    rollback on     └─────────────┘
                     failure
```

## Handler Contract

### Migration Handler

```javascript
/**
 * @param {any} data - The current data to migrate
 * @returns {Promise<any>} - The migrated data
 */
async function migrationHandler(data) {
  // Transform data from old format to new format
  return transformedData;
}
```

### Rollback Handler

```javascript
/**
 * @param {any} data - The original data before migration
 * @param {Error} error - The error that caused the migration to fail
 * @returns {Promise<any>} - The restored/rolled back data
 */
async function rollbackHandler(data, error) {
  // Restore data to its original state
  return restoredData;
}
```

## Registering Handlers

```javascript
const VersionManager = require('./core/versioning/version-manager');

const vm = new VersionManager();

// Register versions
vm.registerVersion('user-service', '1.0.0', {
  endpoints: [...],
  baseUrl_changed: 'https://api.example.com/v1'
});

vm.registerVersion('user-service', '2.0.0', {
  endpoints: [...],
  baseUrl_changed: 'https://api.example.com/v2'
});

// Register migration handler
vm.registerMigrationHandler('user-service', '1.0.0', '2.0.0', async (data) => {
  // Your migration logic here
  return {
    ...data,
    version: '2.0.0',
    format: 'new'
  };
});

// Register rollback handler (optional but recommended)
vm.registerRollbackHandler('user-service', '1.0.0', '2.0.0', async (data, error) => {
  console.error('Migration failed:', error.message);
  return data; // Restore original
});
```

## Migration Handler Patterns

### 1. Field Renaming

```javascript
vm.registerMigrationHandler('api', '1.0.0', '2.0.0', async (data) => {
  return {
    id: data.userId,
    email: data.emailAddress,
    name: data.fullName,
    // ... other mapped fields
  };
});
```

### 2. Data Transformation

```javascript
vm.registerMigrationHandler('config', '1.0.0', '2.0.0', async (data) => {
  // Convert flat structure to nested
  return {
    settings: {
      theme: data.themeColor,
      language: data.defaultLanguage,
      timezone: data.userTimezone
    },
    preferences: data.preferences
  };
});
```

### 3. Schema Evolution

```javascript
vm.registerMigrationHandler('schema', '1.0.0', '2.0.0', async (data) => {
  // Add new required fields with defaults
  return {
    ...data,
    createdAt: data.timestamp || new Date().toISOString(),
    metadata: {
      migratedFrom: '1.0.0',
      migratedAt: new Date().toISOString()
    }
  };
});
```

### 4. Data Validation with Migration

```javascript
vm.registerMigrationHandler('user', '1.0.0', '2.0.0', async (data) => {
  // Validate and sanitize
  if (!data.email) {
    throw new Error('Email is required for v2.0.0');
  }
  
  return {
    ...data,
    email: data.email.toLowerCase().trim(),
    verified: data.verified || false
  };
});
```

### 5. Batch Processing

```javascript
vm.registerMigrationHandler('records', '1.0.0', '2.0.0', async (data) => {
  if (!Array.isArray(data.items)) {
    throw new Error('Expected items array');
  }
  
  return {
    ...data,
    items: data.items.map(item => ({
      ...item,
      processed: true,
      processedAt: new Date().toISOString()
    })),
    totalProcessed: data.items.length
  };
});
```

## Rollback Handler Patterns

### 1. Simple Restoration

```javascript
vm.registerRollbackHandler('user', '1.0.0', '2.0.0', async (data, error) => {
  // Just return the original data unchanged
  return data;
});
```

### 2. Logging with Restoration

```javascript
vm.registerRollbackHandler('api', '1.0.0', '2.0.0', async (data, error) => {
  // Log the failure for debugging
  console.error({
    message: 'Migration rollback',
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  return data;
});
```

### 3. Partial Rollback

```javascript
vm.registerRollbackHandler('config', '1.0.0', '2.0.0', async (data, error) => {
  // Roll back only certain fields
  return {
    ...data,
    newField: undefined, // Remove new field
    version: '1.0.0'     // Restore version
  };
});
```

### 4. Data Recovery

```javascript
vm.registerRollbackHandler('records', '1.0.0', '2.0.0', async (data, error) => {
  // Attempt to recover partial results
  if (data.partialResults) {
    return {
      ...data.originalState,
      partialResults: data.partialResults,
      recoveryAttempted: true
    };
  }
  return data;
});
```

## Automatic Rollback Behavior

The Version Manager implements automatic rollback on migration failure:

```
┌────────────────────────────────────────────────────────────────┐
│                    executeMigration()                           │
│                                                                │
│  1. Create snapshot (pre-migration state)                      │
│  2. Execute migration handler                                  │
│  3. On success: return migrated data                          │
│  4. On failure:  ───► executeRollback()                        │
│                                                                │
│                         Rollback Priority:                     │
│                         1. Explicit rollback handler           │
│                         2. Snapshot restoration               │
│                         3. Emit failure event                 │
└────────────────────────────────────────────────────────────────┘
```

### Rollback Priority

| Priority | Mechanism | When Used |
|----------|-----------|-----------|
| 1 | Explicit rollback handler | `registerRollbackHandler()` was called |
| 2 | Snapshot restoration | Snapshot exists from pre-migration |
| 3 | Failure event | No rollback possible |

## Event System

### Listening to Migration Events

```javascript
vm.on('migration:completed', (event) => {
  console.log('Migration succeeded:', {
    serviceId: event.serviceId,
    fromVersion: event.fromVersion,
    toVersion: event.toVersion,
    snapshotId: event.snapshotId
  });
});

vm.on('migration:failed', (event) => {
  console.error('Migration failed:', event);
});

vm.on('migration:rolled_back', (event) => {
  console.log('Rollback succeeded:', {
    serviceId: event.serviceId,
    originalError: event.originalError,
    snapshotId: event.snapshotId
  });
});

vm.on('migration:rollback_failed', (event) => {
  console.error('Rollback failed:', {
    serviceId: event.serviceId,
    error: event.error,
    rollbackError: event.rollbackError,
    reason: event.reason
  });
});
```

### Event Payloads

| Event | Key Fields |
|-------|------------|
| `migration:completed` | serviceId, fromVersion, toVersion, data, snapshotId |
| `migration:failed` | serviceId, fromVersion, toVersion, error |
| `migration:rolled_back` | serviceId, fromVersion, toVersion, originalData, rolledBackData, originalError, snapshotId |
| `migration:rollback_failed` | serviceId, fromVersion, toVersion, error, rollbackError?, reason? |

## Executing Migrations

### Basic Execution

```javascript
try {
  const migratedData = await vm.executeMigration(
    'user-service',
    '1.0.0',
    '2.0.0',
    currentData
  );
  console.log('Success:', migratedData);
} catch (error) {
  console.error('Migration failed:', error.message);
  // Rollback was already attempted automatically
}
```

### With Manual Snapshot

```javascript
// Create manual snapshot before execution
const snapshot = vm.createMigrationSnapshot(
  'user-service',
  '1.0.0',
  '2.0.0',
  data
);

// Later, execute migration (auto-snapshot created again)
const result = await vm.executeMigration(
  'user-service',
  '1.0.0',
  '2.0.0',
  data
);

// Or retrieve the auto-created snapshot
const autoSnapshot = vm.getSnapshot('user-service', '1.0.0', '2.0.0');
```

### Retrieving Snapshots

```javascript
// Get specific snapshot
const snapshot = vm.getSnapshot('user-service', '1.0.0', '2.0.0');

// Get all snapshots
const allSnapshots = vm.getAllSnapshots();

// Clear snapshots after successful migration
vm.clearSnapshots('user-service', '1.0.0', '2.0.0');
```

## Testing Migration Handlers

### Unit Test Example

```javascript
const VersionManager = require('../../core/versioning/version-manager');

describe('Migration Handler', () => {
  let vm;

  beforeEach(() => {
    vm = new VersionManager();
  });

  test('migrates data correctly', async () => {
    vm.registerVersion('test', '1.0.0', { endpoints: [] });
    vm.registerVersion('test', '2.0.0', { endpoints: [] });

    vm.registerMigrationHandler('test', '1.0.0', '2.0.0', async (data) => ({
      ...data,
      migrated: true
    }));

    const result = await vm.executeMigration('test', '1.0.0', '2.0.0', { original: true });

    expect(result.original).toBe(true);
    expect(result.migrated).toBe(true);
  });

  test('rolls back on failure', async () => {
    vm.registerVersion('test', '1.0.0', { endpoints: [] });
    vm.registerVersion('test', '2.0.0', { endpoints: [] });

    vm.registerMigrationHandler('test', '1.0.0', '2.0.0', async () => {
      throw new Error('Intentional failure');
    });

    vm.registerRollbackHandler('test', '1.0.0', '2.0.0', async (data) => data);

    const rollbackSpy = jest.fn();
    vm.on('migration:rolled_back', rollbackSpy);

    await expect(
      vm.executeMigration('test', '1.0.0', '2.0.0', { data: 'original' })
    ).rejects.toThrow('Intentional failure');

    expect(rollbackSpy).toHaveBeenCalled();
  });
});
```

## Best Practices

### 1. Always Register Rollback Handlers

```javascript
// Good
vm.registerMigrationHandler('svc', '1.0.0', '2.0.0', migrate);
vm.registerRollbackHandler('svc', '1.0.0', '2.0.0', rollback);

// Bad - No rollback path on failure
vm.registerMigrationHandler('svc', '1.0.0', '2.0.0', migrate);
```

### 2. Validate Before Transforming

```javascript
vm.registerMigrationHandler('user', '1.0.0', '2.0.0', async (data) => {
  // Validate required fields first
  if (!data.email) {
    throw new Error('Email is required');
  }
  
  // Then transform
  return { ...data, email: data.email.toLowerCase() };
});
```

### 3. Preserve Original Data

```javascript
vm.registerMigrationHandler('data', '1.0.0', '2.0.0', async (data) => {
  return {
    ...data,
    _v1: { /* original snapshot */ },
    // ... new format
  };
});
```

### 4. Log Migration Steps

```javascript
vm.registerMigrationHandler('complex', '1.0.0', '2.0.0', async (data) => {
  console.log('Starting migration from 1.0.0 to 2.0.0');
  
  const step1 = await migrateStep1(data);
  console.log('Step 1 complete');
  
  const step2 = await migrateStep2(step1);
  console.log('Step 2 complete');
  
  return step2;
});
```

### 5. Idempotent Migrations

```javascript
vm.registerMigrationHandler('data', '1.0.0', '2.0.0', async (data) => {
  // Check if already migrated
  if (data.version === '2.0.0') {
    return data; // Already migrated, no-op
  }
  
  return { ...data, version: '2.0.0' };
});
```

## Common Pitfalls

### Forgetting to Return

```javascript
// Bad - Returns undefined
vm.registerMigrationHandler('test', '1.0.0', '2.0.0', async (data) => {
  data.migrated = true;
});

// Good - Returns transformed data
vm.registerMigrationHandler('test', '1.0.0', '2.0.0', async (data) => {
  return { ...data, migrated: true };
});
```

### Mutating Original Data

```javascript
// Bad - Mutates input
vm.registerMigrationHandler('test', '1.0.0', '2.0.0', async (data) => {
  data.version = '2.0.0'; // Mutates original!
  return data;
});

// Good - Creates new object
vm.registerMigrationHandler('test', '1.0.0', '2.0.0', async (data) => {
  return { ...data, version: '2.0.0' };
});
```

### Throwing Non-Error Objects

```javascript
// Bad - String instead of Error
vm.registerMigrationHandler('test', '1.0.0', '2.0.0', async (data) => {
  throw 'Something went wrong'; // Won't be caught properly
});

// Good - Proper Error object
vm.registerMigrationHandler('test', '1.0.0', '2.0.0', async (data) => {
  throw new Error('Something went wrong');
});
```

## Related Documentation

- [Version Manager Hardening](./version-manager-hardening.md) — Extended Version Manager features
- [Release Process](../../lan-onasis-monorepo/docs/RELEASE.md) — Publishing workflow
- [Sync Script Contract](../../lan-onasis-monorepo/scripts/sync-security-packages.md) — Package synchronization
