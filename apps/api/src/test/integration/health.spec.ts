import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../main.js';

describe('Health Checks (Phase 0 Foundation)', () => {
  it('GET /health/live should return 200 UP', async () => {
    const app = createApp();
    const res = await request(app).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('GET /api/v1 should return API status', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('TrueCO API');
    expect(res.body.version).toBe('1.0.0');
  });
});
