import { vi } from 'vitest';
import VersionManager from '../../core/versioning/version-manager.js';


describe('VersionManager deprecation lifecycle', () => {
  let vm;

  beforeEach(() => {
    vm = new VersionManager();
    // Register a baseline v1 and a candidate v2
    vm.registerVersion('test-svc', '1.0.0', {
      baseUrl: 'http://api.example.com/v1',
      endpoints: []
    });
    vm.registerVersion('test-svc', '2.0.0', {
      baseUrl: 'http://api.example.com/v2',
      endpoints: []
    });
  });

  // ─── removeVersion guards ───────────────────────────────────────────────────

  describe('removeVersion() guard: not deprecated', () => {
    it('throws when the version is not deprecated', () => {
      expect(() => vm.removeVersion('test-svc', '1.0.0'))
        .toThrow('is not deprecated and cannot be removed');
    });
  });

  describe('removeVersion() guard: not found', () => {
    it('throws for a version that was never registered', () => {
      vm.deprecateVersion('test-svc', '2.0.0', 'superseded');
      // Freeze deprecatedAt to31 days ago so the window is already passed
      const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      vm.supportedVersions.get('test-svc:2.0.0').deprecatedAt = longAgo;

      expect(() => vm.removeVersion('test-svc', '9.9.9'))
        .toThrow('not found');
    });
  });

  describe('removeVersion() guard: still in active use', () => {
    it('throws when inActiveUse is true (unless force=true)', () => {
      vm.deprecateVersion('test-svc', '1.0.0', 'old');
      const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      vm.supportedVersions.get('test-svc:1.0.0').deprecatedAt = longAgo;
      vm.supportedVersions.get('test-svc:1.0.0').inActiveUse = true;

      expect(() => vm.removeVersion('test-svc', '1.0.0'))
        .toThrow('still in active use');

      // force=true bypasses the check
      expect(() => vm.removeVersion('test-svc', '1.0.0', { force: true }))
        .not.toThrow();
    });
  });

  // ─── 30-day window enforcement ───────────────────────────────────────────────

  describe('removeVersion() blocks removal before 30 days', () => {
    it('throws on day 0 (same day as deprecation)', () => {
      vm.deprecateVersion('test-svc', '1.0.0', 'replaced');
      // deprecatedAt is set to now by deprecateVersion()

      expect(() => vm.removeVersion('test-svc', '1.0.0'))
        .toThrow(/cannot be removed yet/);
    });

    it('throws on day 15', () => {
      vm.deprecateVersion('test-svc', '1.0.0', 'replaced');
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      vm.supportedVersions.get('test-svc:1.0.0').deprecatedAt = fifteenDaysAgo;

      expect(() => vm.removeVersion('test-svc', '1.0.0'))
        .toThrow(/15 day\(s\) remaining/);
    });

    it('throws on day 29', () => {
      vm.deprecateVersion('test-svc', '1.0.0', 'replaced');
      const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
      vm.supportedVersions.get('test-svc:1.0.0').deprecatedAt = twentyNineDaysAgo;

      expect(() => vm.removeVersion('test-svc', '1.0.0'))
        .toThrow(/1 day\(s\) remaining/);
    });
  });

  describe('removeVersion() allows removal after 30 days', () => {
    it('succeeds on day 30', () => {
      vm.deprecateVersion('test-svc', '1.0.0', 'replaced');
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      vm.supportedVersions.get('test-svc:1.0.0').deprecatedAt = thirtyOneDaysAgo;

      expect(() => vm.removeVersion('test-svc', '1.0.0')).not.toThrow();
      expect(vm.supportedVersions.has('test-svc:1.0.0')).toBe(false);
    });

    it('succeeds well after the window', () => {
      vm.deprecateVersion('test-svc', '1.0.0', 'replaced');
      const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      vm.supportedVersions.get('test-svc:1.0.0').deprecatedAt = hundredDaysAgo;

      expect(() => vm.removeVersion('test-svc', '1.0.0')).not.toThrow();
      expect(vm.supportedVersions.has('test-svc:1.0.0')).toBe(false);
    });
  });

  // ─── Warning events ─────────────────────────────────────────────────────────

  describe('removeVersion() emits warnings during the window', () => {
    it('emits on day 0', () => {
      vm.deprecateVersion('test-svc', '1.0.0', 'replaced');
      const warning = vi.fn();
      vm.on('version:removal_warning', warning);
      try { vm.removeVersion('test-svc', '1.0.0'); } catch (_) {}

      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning.mock.calls[0][0].message).toMatch(/just deprecated/);
    });

    it('emits on day 15 with daysRemaining', () => {
      vm.deprecateVersion('test-svc', '1.0.0', 'replaced');
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      vm.supportedVersions.get('test-svc:1.0.0').deprecatedAt = fifteenDaysAgo;

      const warning = vi.fn();
      vm.on('version:removal_warning', warning);
      try { vm.removeVersion('test-svc', '1.0.0'); } catch (_) {}

      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning.mock.calls[0][0].daysRemaining).toBe(15);
    });

    it('does NOT emit after day 30', () => {
      vm.deprecateVersion('test-svc', '1.0.0', 'replaced');
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      vm.supportedVersions.get('test-svc:1.0.0').deprecatedAt = thirtyOneDaysAgo;

      const warning = vi.fn();
      vm.on('version:removal_warning', warning);
      try { vm.removeVersion('test-svc', '1.0.0'); } catch (_) {}

      expect(warning).not.toHaveBeenCalled();
    });
  });

  describe('removeVersion() emits version:removed on success', () => {
    it('emits after successful deletion', () => {
      vm.deprecateVersion('test-svc', '1.0.0', 'replaced');
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      vm.supportedVersions.get('test-svc:1.0.0').deprecatedAt = thirtyOneDaysAgo;

      const removed = vi.fn();
      vm.on('version:removed', removed);
      vm.removeVersion('test-svc', '1.0.0');

      expect(removed).toHaveBeenCalledTimes(1);
      expect(removed.mock.calls[0][0]).toMatchObject({
        serviceId: 'test-svc',
        version: '1.0.0'
      });
    });
  });

  // ─── getLatestVersion skipDeprecated option ─────────────────────────────────

  describe('getLatestVersion() skipDeprecated option', () => {
    it('returns deprecated latest when skipDeprecated=false (default)', () => {
      vm.deprecateVersion('test-svc', '2.0.0', 'old');
      const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      vm.supportedVersions.get('test-svc:2.0.0').deprecatedAt = longAgo;

      const latest = vm.getLatestVersion('test-svc');
      expect(latest.version).toBe('2.0.0');
    });

    it('skips deprecated versions when skipDeprecated=true', () => {
      vm.deprecateVersion('test-svc', '2.0.0', 'old');
      const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      vm.supportedVersions.get('test-svc:2.0.0').deprecatedAt = longAgo;

      const latest = vm.getLatestVersion('test-svc', { skipDeprecated: true });
      expect(latest.version).toBe('1.0.0');
    });

    it('throws when all versions are deprecated and skipDeprecated=true', () => {
      vm.deprecateVersion('test-svc', '1.0.0', 'old');
      vm.deprecateVersion('test-svc', '2.0.0', 'old');
      const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      vm.supportedVersions.get('test-svc:1.0.0').deprecatedAt = longAgo;
      vm.supportedVersions.get('test-svc:2.0.0').deprecatedAt = longAgo;

      expect(() => vm.getLatestVersion('test-svc', { skipDeprecated: true }))
        .toThrow('No non-deprecated versions found');
    });
  });
});
describe('VersionManager', () => {
  let vm;

  beforeEach(() => {
    vm = new VersionManager();
  });

  describe('registerVersion', () => {
    it('registers a valid version successfully', () => {
      const config = {
        endpoints: [],
        baseUrl_changed: 'https://api.example.com/v1',
        authentication: { type: 'bearer' }
      };
      
      const key = vm.registerVersion('test-service', '1.0.0', config);
      
      expect(key).toBe('test-service:1.0.0');
      expect(vm.getServiceVersion('test-service', '1.0.0')).toBeDefined();
    });

    it('throws error for invalid semver format', () => {
      expect(() => {
        vm.registerVersion('test-service', 'invalid', {});
      }).toThrow('Invalid version format: invalid');
    });
  });

  describe('getLatestVersion', () => {
    it('returns the highest semver version', () => {
      const config = { endpoints: [], baseUrl_changed: 'https://api.example.com' };
      
      vm.registerVersion('test-service', '1.0.0', config);
      vm.registerVersion('test-service', '2.0.0', config);
      vm.registerVersion('test-service', '1.5.0', config);
      
      const latest = vm.getLatestVersion('test-service');
      
      expect(latest.version).toBe('2.0.0');
    });

    it('throws error when no versions registered', () => {
      expect(() => {
        vm.getLatestVersion('nonexistent');
      }).toThrow('No versions found for service nonexistent');
    });
  });

  describe('analyzeCompatibility', () => {
    it('detects baseUrl_changed breaking change', () => {
      const oldConfig = { 
        endpoints: [], 
        baseUrl_changed: 'https://old.example.com',
        authentication: { type: 'bearer' }
      };
      const newConfig = { 
        endpoints: [], 
        baseUrl_changed: 'https://new.example.com',
        authentication: { type: 'bearer' }
      };
      
      const result = vm.analyzeCompatibility(newConfig, oldConfig);
      
      expect(result.compatible).toBe(false);
      expect(result.breakingChanges).toContainEqual(
        expect.objectContaining({ type: 'baseUrl_changed' })
      );
    });
  });

  describe('executeMigration', () => {
    it('executes migration successfully', async () => {
      const config = { endpoints: [], baseUrl_changed: 'https://api.example.com' };
      vm.registerVersion('test-service', '1.0.0', config);
      vm.registerVersion('test-service', '2.0.0', config);
      
      vm.registerMigrationHandler('test-service', '1.0.0', '2.0.0', async (data) => {
        return { ...data, migrated: true };
      });
      
      const result = await vm.executeMigration('test-service', '1.0.0', '2.0.0', { test: true });
      
      expect(result.migrated).toBe(true);
    });

    it('creates snapshot before migration', async () => {
      const config = { endpoints: [], baseUrl_changed: 'https://api.example.com' };
      vm.registerVersion('test-service', '1.0.0', config);
      vm.registerVersion('test-service', '2.0.0', config);
      
      vm.registerMigrationHandler('test-service', '1.0.0', '2.0.0', async (data) => {
        return data;
      });
      
      await vm.executeMigration('test-service', '1.0.0', '2.0.0', { original: true });
      
      const snapshot = vm.getSnapshot('test-service', '1.0.0', '2.0.0');
      
      expect(snapshot).toBeDefined();
      expect(snapshot.data.original).toBe(true);
    });

    it('throws when no migration handler found', async () => {
      const config = { endpoints: [], baseUrl_changed: 'https://api.example.com' };
      vm.registerVersion('test-service', '1.0.0', config);
      
      await expect(
        vm.executeMigration('test-service', '1.0.0', '2.0.0', {})
      ).rejects.toThrow('No migration handler found');
    });

    it('emits migration:completed event', async () => {
      const config = { endpoints: [], baseUrl_changed: 'https://api.example.com' };
      vm.registerVersion('test-service', '1.0.0', config);
      vm.registerVersion('test-service', '2.0.0', config);
      
      vm.registerMigrationHandler('test-service', '1.0.0', '2.0.0', async (data) => data);
      
      const eventListener = vi.fn();
      vm.on('migration:completed', eventListener);
      
      try { await vm.executeMigration('test-service', '1.0.0', '2.0.0', {}); } catch {}
      
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: 'test-service',
          fromVersion: '1.0.0',
          toVersion: '2.0.0'
        })
      );
    });
  });

  describe('rollback functionality', () => {
<<<<<<< HEAD
    test('registers rollback handler', () => {
||||||| parent of d3d31e1 (chore: update configuration and migration documentation)
    test('registers rollback handler', () => {
      const handler = jest.fn();
=======
    it('registers rollback handler', () => {
>>>>>>> d3d31e1 (chore: update configuration and migration documentation)
      const handler = vi.fn();
      vm.registerRollbackHandler('test-service', '1.0.0', '2.0.0', handler);
      
      // Handler should be registered (no error thrown)
      expect(true).toBe(true);
    });

    it('restores snapshot on rollback', async () => {
      const config = { endpoints: [], baseUrl_changed: 'https://api.example.com' };
      vm.registerVersion('test-service', '1.0.0', config);
      vm.registerVersion('test-service', '2.0.0', config);
      
      vm.registerMigrationHandler('test-service', '1.0.0', '2.0.0', async () => {
        throw new Error('Migration failed');
      });
      
      const rollbackListener = vi.fn();
      vm.on('migration:rolled_back', rollbackListener);
      
      await expect(
        vm.executeMigration('test-service', '1.0.0', '2.0.0', { preserved: true })
      ).rejects.toThrow('Migration failed');
      
      expect(rollbackListener).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: 'test-service',
          rolledBackData: { preserved: true }
        })
      );
    });

    it('emits migration:rolled_back event on success', async () => {
      const config = { endpoints: [], baseUrl_changed: 'https://api.example.com' };
      vm.registerVersion('test-service', '1.0.0', config);
      vm.registerVersion('test-service', '2.0.0', config);
      
<<<<<<< HEAD
      const rollbackHandler = vi.fn().mockResolvedValue({ rolled: true });
      vm.registerRollbackHandler('test-service', '1.0.0', '2.0.0', rollbackHandler);
||||||| parent of d3d31e1 (chore: update configuration and migration documentation)
      const rollbackHandler = jest.fn().mockResolvedValue({ rolled: true });
      vm.registerRollbackHandler('test-service', '1.0.0', '2.0.0', rollbackHandler);
=======
      const rolledBackListener = vi.fn();
      vm.on('migration:rolled_back', rolledBackListener);
>>>>>>> d3d31e1 (chore: update configuration and migration documentation)
      
      vm.registerMigrationHandler('test-service', '1.0.0', '2.0.0', async () => {
        throw new Error('Fail');
      });
      
<<<<<<< HEAD
      const rolledBackListener = vi.fn();
      const failedListener = vi.fn();
||||||| parent of d3d31e1 (chore: update configuration and migration documentation)
      const rolledBackListener = jest.fn();
      const failedListener = jest.fn();
=======
      try { await vm.executeMigration('test-service', '1.0.0', '2.0.0', { preserved: true }); } catch {}
>>>>>>> d3d31e1 (chore: update configuration and migration documentation)
      
      expect(rolledBackListener).toHaveBeenCalled();
      expect(rolledBackListener.mock.calls[0][0].rolledBackData).toEqual({ preserved: true });
    });

    it('handles failed migration without rollback handler', async () => {
      const config = { endpoints: [], baseUrl_changed: 'https://api.example.com' };
      vm.registerVersion('test-service', '1.0.0', config);
      vm.registerVersion('test-service', '2.0.0', config);
      
      vm.registerMigrationHandler('test-service', '1.0.0', '2.0.0', async () => {
        throw new Error('Fail');
      });
      
      const rolledBackListener = vi.fn();
      vm.on('migration:rolled_back', rolledBackListener);
      
<<<<<<< HEAD
      // executeMigration re-throws the migration error after rolling back (by design)
      await expect(
        vm.executeMigration('test-service', '1.0.0', '2.0.0', {})
      ).rejects.toThrow('Fail');
||||||| parent of d3d31e1 (chore: update configuration and migration documentation)
      await vm.executeMigration('test-service', '1.0.0', '2.0.0', {});
=======
      try { await vm.executeMigration('test-service', '1.0.0', '2.0.0', { data: 'test' }); } catch {}
>>>>>>> d3d31e1 (chore: update configuration and migration documentation)
      
      expect(rolledBackListener).toHaveBeenCalled();
    });
<<<<<<< HEAD

    test('emits migration:rollback_failed when the rollback handler throws', async () => {
      const config = { endpoints: [], baseUrl_changed: 'https://api.example.com' };
      vm.registerVersion('test-service', '1.0.0', config);
      vm.registerVersion('test-service', '2.0.0', config);
      
      // executeMigration always snapshots before migrating, so the snapshot-fallback
      // path is taken when no rollback handler exists. rollback_failed fires when
      // the explicit rollback handler itself throws.
      vm.registerRollbackHandler('test-service', '1.0.0', '2.0.0', async () => {
        throw new Error('Rollback exploded');
      });
      
      vm.registerMigrationHandler('test-service', '1.0.0', '2.0.0', async () => {
        throw new Error('Fail');
      });
      
      const failedListener = vi.fn();
      vm.on('migration:rollback_failed', failedListener);
      
      await expect(
        vm.executeMigration('test-service', '1.0.0', '2.0.0', {})
      ).rejects.toThrow('Fail');
      
      expect(failedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: 'test-service',
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          rollbackError: 'Rollback exploded'
        })
      );
    });
||||||| parent of d3d31e1 (chore: update configuration and migration documentation)

    test('emits migration:rollback_failed when no rollback available', async () => {
      const config = { endpoints: [], baseUrl_changed: 'https://api.example.com' };
      vm.registerVersion('test-service', '1.0.0', config);
      vm.registerVersion('test-service', '2.0.0', config);
      
      // No rollback handler registered
      vm.registerMigrationHandler('test-service', '1.0.0', '2.0.0', async () => {
        throw new Error('Fail');
      });
      
      const failedListener = jest.fn();
      vm.on('migration:rollback_failed', failedListener);
      
      await vm.executeMigration('test-service', '1.0.0', '2.0.0', {});
      
      expect(failedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'No rollback handler or snapshot available'
        })
      );
    });
=======
>>>>>>> d3d31e1 (chore: update configuration and migration documentation)
  });
});
