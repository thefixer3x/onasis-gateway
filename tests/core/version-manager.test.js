const VersionManager = require('../../core/versioning/version-manager');

describe('VersionManager - semver validation', () => {
  it('rejects an invalid semver on registerVersion', () => {
    const vm = new VersionManager();
    expect(() => vm.registerVersion('svc', 'not-semver', {})).toThrow('Invalid version format');
  });

  it('accepts a valid semver and emits version:registered', () => {
    const vm = new VersionManager();
    const events = [];
    vm.on('version:registered', (e) => events.push(e));
    const config = { baseUrl: 'https://a', endpoints: [], authentication: { type: 'bearer' } };
    vm.registerVersion('svc', '1.0.0', config);
    expect(events).toHaveLength(1);
    expect(events[0].version).toBe('1.0.0');
  });
});

describe('VersionManager - breaking change detection', () => {
  const oldC = () => ({ baseUrl: 'https://a', endpoints: [], authentication: { type: 'bearer' } });

  it('flags a base URL change as breaking with type "baseUrl_changed"', () => {
    const vm = new VersionManager();
    const newC = { baseUrl: 'https://b', endpoints: [], authentication: { type: 'bearer' } };
    const c = vm.analyzeCompatibility(newC, oldC());
    expect(c.compatible).toBe(false);
    expect(c.breakingChanges.some((b) => b.type === 'baseUrl_changed')).toBe(true);
  });

  it('flags a removed endpoint as breaking and not compatible', () => {
    const vm = new VersionManager();
    const oldConfig = { baseUrl: 'https://a', authentication: { type: 'bearer' }, endpoints: [{ id: 'getUser', method: 'GET', path: '/u' }] };
    const newConfig = { baseUrl: 'https://a', authentication: { type: 'bearer' }, endpoints: [] };
    const c = vm.analyzeCompatibility(newConfig, oldConfig);
    expect(c.compatible).toBe(false);
    expect(c.breakingChanges.some((b) => b.type === 'endpoint_removed')).toBe(true);
  });

  it('treats an added optional endpoint as compatible', () => {
    const vm = new VersionManager();
    const oldConfig = { baseUrl: 'https://a', authentication: { type: 'bearer' }, endpoints: [] };
    const newConfig = { baseUrl: 'https://a', authentication: { type: 'bearer' }, endpoints: [{ id: 'new', method: 'GET', path: '/n' }] };
    const c = vm.analyzeCompatibility(newConfig, oldConfig);
    expect(c.compatible).toBe(true);
  });
});

describe('VersionManager - migrations with rollback', () => {
  it('runs the handler, returns migrated data, and emits migration:completed', async () => {
    const vm = new VersionManager();
    vm.registerMigrationHandler('svc', '1.0.0', '2.0.0', (d) => ({ ...d, migrated: true }));
    const completed = [];
    vm.on('migration:completed', (e) => completed.push(e));
    const result = await vm.executeMigration('svc', '1.0.0', '2.0.0', { a: 1 });
    expect(result).toEqual({ a: 1, migrated: true });
    expect(completed).toHaveLength(1);
  });

  it('throws when no migration handler is registered', async () => {
    const vm = new VersionManager();
    await expect(vm.executeMigration('svc', '1.0.0', '2.0.0', {})).rejects.toThrow('No migration handler');
  });

  it('rolls back to the original (pre-mutation) data when the handler throws', async () => {
    const vm = new VersionManager();
    // handler mutates the input then throws — rollback must restore the snapshot, not the mutated object
    vm.registerMigrationHandler('svc', '1.0.0', '2.0.0', (d) => {
      d.count = 999;
      throw new Error('boom');
    });
    const rolledBack = [];
    vm.on('migration:rolled_back', (e) => rolledBack.push(e));
    await expect(vm.executeMigration('svc', '1.0.0', '2.0.0', { count: 1 })).rejects.toThrow('boom');
    expect(rolledBack).toHaveLength(1);
    expect(rolledBack[0].restoredData).toEqual({ count: 1 });
  });

  it('invokes an explicit rollback handler with the snapshot and the error', async () => {
    const vm = new VersionManager();
    let captured = null;
    vm.registerMigrationHandler(
      'svc',
      '1.0.0',
      '2.0.0',
      () => {
        throw new Error('fail');
      },
      (snapshot, err) => {
        captured = { snapshot, msg: err.message };
        return { restored: true };
      },
    );
    await expect(vm.executeMigration('svc', '1.0.0', '2.0.0', { a: 1 })).rejects.toThrow('fail');
    expect(captured.snapshot).toEqual({ a: 1 });
    expect(captured.msg).toBe('fail');
  });

  it('surfaces a composite error and emits migration:rollback_failed when rollback itself throws', async () => {
    const vm = new VersionManager();
    vm.registerMigrationHandler(
      'svc',
      '1.0.0',
      '2.0.0',
      () => {
        throw new Error('orig');
      },
      () => {
        throw new Error('rollback-broke');
      },
    );
    const failed = [];
    vm.on('migration:rollback_failed', (e) => failed.push(e));
    await expect(vm.executeMigration('svc', '1.0.0', '2.0.0', {})).rejects.toThrow(/rollback/i);
    expect(failed).toHaveLength(1);
  });
});
