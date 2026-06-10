import { describe, it, expect, beforeEach, vi } from 'vitest';
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
