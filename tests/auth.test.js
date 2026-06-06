process.env.JWT_SECRET = 'test-secret'; // deterministic tokens across the suite
process.env.ANTHROPIC_API_KEY = 'test-key'; // transliterate route mounts on server

jest.mock('../src/db/client', () => ({ query: jest.fn() }));
jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } }))
);

const request = require('supertest');
const pool = require('../src/db/client');
const app = require('../server');
const {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
} = require('../src/auth/credentials');
const { attachAdmin, requireAdmin } = require('../src/middleware/auth');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

beforeEach(() => {
  pool.query.mockReset();
});

describe('credentials', () => {
  test('hash/verify round-trip', async () => {
    const hash = await hashPassword('s3cret');
    expect(hash).not.toBe('s3cret');
    expect(await verifyPassword('s3cret', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  test('verifyPassword is false for empty inputs', async () => {
    expect(await verifyPassword('', 'x')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });

  test('token sign/verify round-trip', () => {
    const token = signToken({ id: 'u1', username: 'admin' });
    const payload = verifyToken(token);
    expect(payload.id).toBe('u1');
    expect(payload.username).toBe('admin');
  });

  test('verifyToken returns null for garbage / empty', () => {
    expect(verifyToken('not-a-token')).toBeNull();
    expect(verifyToken('')).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
  });
});

describe('auth middleware', () => {
  test('requireAdmin → 401 when no admin', () => {
    const req = { admin: null };
    const res = mockRes();
    let nextCalled = false;
    requireAdmin(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(nextCalled).toBe(false);
  });

  test('requireAdmin → next() when admin present', () => {
    const req = { admin: { id: 'u1', username: 'admin' } };
    const res = mockRes();
    let nextCalled = false;
    requireAdmin(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  test('attachAdmin sets req.admin from a valid cookie', () => {
    const token = signToken({ id: 'u1', username: 'admin' });
    const req = { cookies: { token } };
    let nextCalled = false;
    attachAdmin(req, mockRes(), () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(req.admin).toEqual({ id: 'u1', username: 'admin' });
  });

  test('attachAdmin sets null on missing / garbage / no-cookies', () => {
    const reqEmpty = { cookies: {} };
    attachAdmin(reqEmpty, mockRes(), () => {});
    expect(reqEmpty.admin).toBeNull();

    const reqGarbage = { cookies: { token: 'garbage' } };
    attachAdmin(reqGarbage, mockRes(), () => {});
    expect(reqGarbage.admin).toBeNull();

    const reqNone = {};
    attachAdmin(reqNone, mockRes(), () => {});
    expect(reqNone.admin).toBeNull();
  });
});

describe('auth routes', () => {
  function cookieFor(admin) {
    return `token=${signToken(admin)}`;
  }

  test('GET /status → needsSetup true when no admins', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    const res = await request(app).get('/api/auth/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ needsSetup: true, authed: false });
  });

  test('GET /status → authed true with a valid cookie', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
    const res = await request(app)
      .get('/api/auth/status')
      .set('Cookie', cookieFor({ id: 'u1', username: 'admin' }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ needsSetup: false, authed: true });
  });

  test('POST /setup creates the first admin + sets cookie', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // adminCount
      .mockResolvedValueOnce({ rows: [{ id: 'u1', username: 'admin' }] }); // insert
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ username: 'admin' });
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
  });

  test('POST /setup → 409 when an admin already exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'password123' });
    expect(res.status).toBe(409);
  });

  test('POST /setup → 400 on short password', async () => {
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'short' });
    expect(res.status).toBe(400);
  });

  test('POST /login → 200 + cookie on valid creds', async () => {
    const hash = await hashPassword('password123');
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'u1', username: 'admin', password_hash: hash }],
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: 'admin' });
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
  });

  test('POST /login → 401 on unknown user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost', password: 'password123' });
    expect(res.status).toBe(401);
  });

  test('POST /login → 401 on wrong password', async () => {
    const hash = await hashPassword('password123');
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'u1', username: 'admin', password_hash: hash }],
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpass1' });
    expect(res.status).toBe(401);
  });

  test('GET /me → 401 without cookie, 200 with cookie', async () => {
    const noCookie = await request(app).get('/api/auth/me');
    expect(noCookie.status).toBe(401);

    const withCookie = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookieFor({ id: 'u1', username: 'admin' }));
    expect(withCookie.status).toBe(200);
    expect(withCookie.body).toEqual({ username: 'admin' });
  });

  test('POST /logout clears the cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/token=;/);
  });

  test('POST /admins → 401 without auth', async () => {
    const res = await request(app)
      .post('/api/auth/admins')
      .send({ username: 'second', password: 'password123' });
    expect(res.status).toBe(401);
  });

  test('POST /admins → 201 when authed', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // existence check
      .mockResolvedValueOnce({ rows: [{ id: 'u2', username: 'second' }] }); // insert
    const res = await request(app)
      .post('/api/auth/admins')
      .set('Cookie', cookieFor({ id: 'u1', username: 'admin' }))
      .send({ username: 'second', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ username: 'second' });
  });

  test('POST /admins → 409 on duplicate username', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // exists
    const res = await request(app)
      .post('/api/auth/admins')
      .set('Cookie', cookieFor({ id: 'u1', username: 'admin' }))
      .send({ username: 'admin', password: 'password123' });
    expect(res.status).toBe(409);
  });
});
