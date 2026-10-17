import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server/app';

describe('NotMediaWiki API Gateway Integration Tests', () => {
  it('GET /health returns healthy status and platform metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.platform).toBe('NotMediaWiki-Node-Microservices');
    expect(res.body.version).toBe('1.0.0');
  });

  it('GET /api/v1/content/articles returns list of articles', async () => {
    const res = await request(app).get('/api/v1/content/articles');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.articles)).toBe(true);
    expect(res.body.articles.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/content/articles rejects unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/v1/content/articles').send({
      slug: 'Unauthenticated_Article',
      title: 'Unauthenticated Article',
      wikitext: 'Should be rejected',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Autenticação obrigatória');
  });

  it('POST /api/v1/content/articles with valid token creates article', async () => {
    const res = await request(app)
      .post('/api/v1/content/articles')
      .set('Authorization', 'Bearer test-token-test-editor:editor@example.com')
      .send({
        slug: 'Vitest_Test_Article',
        title: 'Vitest Test Article',
        wikitext: '== Header ==\nConteúdo gerado via teste automatizado',
        comment: 'Created by automated test',
      });
    expect(res.status).toBe(201);
    expect(res.body.article.slug).toBe('Vitest_Test_Article');
    expect(res.body.revision.id).toBeDefined();
  });

  it('POST /api/v1/parsoid/parse sanitizes XSS injection payloads', async () => {
    const res = await request(app)
      .post('/api/v1/parsoid/parse')
      .send({
        wikitext: '== Safe ==\n<script>alert("xss")</script><img src=x onerror=alert(1)> Normal text',
        title: 'XSS_Defense_Test',
      });
    expect(res.status).toBe(200);
    expect(res.body.html).not.toContain('<script>');
    expect(res.body.html).not.toContain('onerror');
    expect(res.body.html).toContain('Normal text');
  });

  it('POST /api/v1/auth/users rejects non-admin caller with 403', async () => {
    const res = await request(app)
      .post('/api/v1/auth/users')
      .set('Authorization', 'Bearer test-token-regular-user:user@example.com')
      .send({
        username: 'HackerUser',
        role: 'sysop',
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Acesso negado');
  });

  it('POST /api/v1/auth/users allows super-admin caller to provision users', async () => {
    const res = await request(app)
      .post('/api/v1/auth/users')
      .set('Authorization', 'Bearer test-token-super-admin:mafersao1100@gmail.com')
      .send({
        username: 'NewModerator',
        role: 'moderator',
        email: 'mod@example.com',
      });
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('NewModerator');
    expect(res.body.user.role).toBe('moderator');
  });

  it('POST /api/v1/migration/parity-test executes real assertions and returns benchmark metrics', async () => {
    const res = await request(app)
      .post('/api/v1/migration/parity-test')
      .set('Authorization', 'Bearer test-token-test-editor:editor@example.com');
    expect(res.status).toBe(200);
    expect(res.body.totalTests).toBe(4);
    expect(res.body.passed).toBe(4);
    expect(res.body.failed).toBe(0);
    expect(res.body.suiteDurationMs).toBeGreaterThan(0);
  });
});
