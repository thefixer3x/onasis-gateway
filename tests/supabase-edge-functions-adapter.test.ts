import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

// @ts-ignore - CommonJS module
import SupabaseEdgeFunctionsAdapter from '../src/adapters/supabase-edge-functions-adapter.js';

const writeTempFile = (contents: string): string => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'supabase-docs-'));
  const filePath = path.join(tmpDir, 'routes.md');
  fs.writeFileSync(filePath, contents, 'utf-8');
  return filePath;
};

describe('SupabaseEdgeFunctionsAdapter', () => {
  it('discovers functions from table and text references', async () => {
    const routesFile = writeTempFile(`
| Function | Method | URL | Auth | Description |
|----------|--------|-----|------|-------------|
| \`memory-create\` | POST | \`/functions/v1/memory-create\` | ✅ | Create memory |
| \`system-health\` | GET | \`/functions/v1/system-health\` | ❌ | Health check |

curl https://example.supabase.co/functions/v1/memory/create
curl https://example.supabase.co/functions/v1/intelligence-health-check
`);

    const adapter = new SupabaseEdgeFunctionsAdapter();
    await adapter.initialize({
      supabaseUrl: 'http://localhost:54321',
      supabaseAnonKey: 'anon',
      routesFilePath: routesFile
    });

    const tools = await adapter.listTools();
    const names = tools.map(tool => tool.name);

    expect(names).toContain('memory-create');
    expect(names).toContain('system-health');
    expect(names).toContain('memory/create');
    expect(names).toContain('intelligence-health-check');

    const memoryTool = tools.find(tool => tool.name === 'memory-create');
    const healthTool = tools.find(tool => tool.name === 'system-health');
    expect(memoryTool.metadata.authRequired).toBe(true);
    expect(healthTool.metadata.authRequired).toBe(false);
  });

  it('deduplicates functions across multiple files', async () => {
    const routesFileA = writeTempFile(`
| Function | Method | URL | Auth | Description |
|----------|--------|-----|------|-------------|
| \`memory-create\` | POST | \`/functions/v1/memory-create\` | ✅ | Create memory |
`);

    const routesFileB = writeTempFile(`
curl https://example.supabase.co/functions/v1/memory-create
curl https://example.supabase.co/functions/v1/memory-delete
`);

    const adapter = new SupabaseEdgeFunctionsAdapter();
    await adapter.initialize({
      supabaseUrl: 'http://localhost:54321',
      supabaseAnonKey: 'anon',
      routesFilePath: `${routesFileA},${routesFileB}`
    });

    const tools = await adapter.listTools();
    const names = tools.map(tool => tool.name);

    expect(names.filter(name => name === 'memory-create').length).toBe(1);
    expect(names).toContain('memory-delete');
  });
});
