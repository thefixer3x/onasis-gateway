import { describe, it, expect, vi } from 'vitest';

import VendorAbstractionImport from '../../core/abstraction/vendor-abstraction.js';

const VendorAbstractionLayer = VendorAbstractionImport?.default || VendorAbstractionImport;

describe('VendorAbstractionLayer AI contracts', () => {
  it('accepts array-based messages and routes chat to ai-router:ai-chat', async () => {
    const callTool = vi.fn().mockResolvedValue({ ok: true });
    const abstraction = new VendorAbstractionLayer({
      adapterRegistry: { callTool }
    });

    const result = await abstraction.executeAbstractedCall(
      'ai',
      'chat',
      {
        messages: [{ role: 'user', content: 'Hello router' }],
        temperature: 0.3
      }
    );

    expect(result.success).toBe(true);
    expect(callTool).toHaveBeenCalledWith(
      'ai-router:ai-chat',
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Hello router' }],
        model: 'qwen2:1.5b',
        temperature: 0.3
      }),
      {}
    );
  });

  it('rejects non-array messages payload with a clear type error', async () => {
    const abstraction = new VendorAbstractionLayer({
      adapterRegistry: { callTool: vi.fn() }
    });

    await expect(
      abstraction.executeAbstractedCall('ai', 'chat', {
        messages: { role: 'user', content: 'invalid shape' }
      })
    ).rejects.toThrow('expected array');
  });
});
