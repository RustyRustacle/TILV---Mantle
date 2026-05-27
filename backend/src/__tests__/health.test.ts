import request from 'supertest';
import app from '../index';

describe('GET /health', () => {
  it('returns 200 with status healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('TILV Backend API');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
  });
});

describe('GET /', () => {
  it('returns 200 with API info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('TILV Backend API');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.endpoints).toBeDefined();
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});

describe('POST /api/v1/process-invoice (validation)', () => {
  it('returns 400 when no file is sent', async () => {
    const res = await request(app)
      .post('/api/v1/process-invoice')
      .field('amount', '1000');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/wallet (validation)', () => {
  it('returns 400 when body is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/wallet')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('address, signature, and message required');
  });
});

describe('Rate limiting', () => {
  it('returns 429 when AI proxy is flooded', async () => {
    const promises = Array.from({ length: 60 }, (_, i) =>
      request(app)
        .post('/api/v1/process-invoice')
        .set('Content-Type', 'multipart/form-data')
    );
    const results = await Promise.all(promises);
    const has429 = results.some((r) => r.status === 429);
    expect(has429).toBe(true);
  }, 30000);
});
