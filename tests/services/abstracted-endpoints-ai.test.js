import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

import AbstractedEndpointsImport from '../../api/abstracted-endpoints.js';

const AbstractedAPIEndpoints = AbstractedEndpointsImport?.default || AbstractedEndpointsImport;

const buildApp = (endpoints) => {
  const app = express();
  app.use(express.json());
  app.use(endpoints.router);
  return app;
};

describe('Abstracted AI endpoint operation mapping', () => {
  it('maps POST /api/v1/ai/chat to abstraction operation "chat"', async () => {
    const endpoints = new AbstractedAPIEndpoints();
    const executeAbstractedCall = vi.fn().mockResolvedValue({
      data: { ok: true },
      metadata: {}
    });
    endpoints.abstraction.executeAbstractedCall = executeAbstractedCall;

    const app = buildApp(endpoints);
    const payload = { messages: [{ role: 'user', content: 'hello' }] };

    const res = await request(app)
      .post('/api/v1/ai/chat')
      .set('X-Request-ID', 'req-ai-chat-1')
      .send(payload);

    expect(res.status).toBe(200);
    expect(executeAbstractedCall).toHaveBeenCalledWith(
      'ai',
      'chat',
      payload,
      null,
      expect.objectContaining({
        requestId: 'req-ai-chat-1'
      })
    );
  });

  it('maps POST /api/v1/ai/health to abstraction operation "health"', async () => {
    const endpoints = new AbstractedAPIEndpoints();
    const executeAbstractedCall = vi.fn().mockResolvedValue({
      data: { healthy: true },
      metadata: {}
    });
    endpoints.abstraction.executeAbstractedCall = executeAbstractedCall;

    const app = buildApp(endpoints);
    const res = await request(app).post('/api/v1/ai/health').send({});

    expect(res.status).toBe(200);
    expect(executeAbstractedCall).toHaveBeenCalledWith('ai', 'health', {}, null, expect.any(Object));
  });
});
