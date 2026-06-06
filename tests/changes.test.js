process.env.JWT_SECRET = 'test-secret';
process.env.ANTHROPIC_API_KEY = 'test-key';

jest.mock('../src/db/client', () => require('./helpers/db-mock').createDbMock());
jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } }))
);

const request = require('supertest');
const pool = require('../src/db/client');
const app = require('../server');
const { signToken } = require('../src/auth/credentials');
const { applyChange, withTransaction } = require('../src/services/mutations');
const { recordPending, recordApplied, summarize } = require('../src/services/changelog');
const { createClientMock } = require('./helpers/db-mock');

const adminCookie = `token=${signToken({ id: 'u1', username: 'admin' })}`;

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockClear();
  pool.__client.query.mockReset();
  pool.__client.release.mockReset();
  pool.connect.mockResolvedValue(pool.__client);
});

describe('settings route', () => {
  test('GET /api/settings → returns both flags (public)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ moderation_enabled: false, show_birth_year: false }] });
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ moderation_enabled: false, show_birth_year: false });
  });

  test('GET /api/settings → both default to false when no tree row', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ moderation_enabled: false, show_birth_year: false });
  });

  test('GET /api/settings → reflects show_birth_year=true', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ moderation_enabled: false, show_birth_year: true }] });
    const res = await request(app).get('/api/settings');
    expect(res.body.show_birth_year).toBe(true);
  });

  test('PATCH /api/settings → 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ moderation_enabled: true });
    expect(res.status).toBe(401);
  });

  test('PATCH /api/settings → toggles moderation with admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ moderation_enabled: true, show_birth_year: false }] });
    const res = await request(app)
      .patch('/api/settings')
      .set('Cookie', adminCookie)
      .send({ moderation_enabled: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ moderation_enabled: true, show_birth_year: false });
  });

  test('PATCH /api/settings → toggles show_birth_year with admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ moderation_enabled: false, show_birth_year: true }] });
    const res = await request(app)
      .patch('/api/settings')
      .set('Cookie', adminCookie)
      .send({ show_birth_year: true });
    expect(res.status).toBe(200);
    expect(res.body.show_birth_year).toBe(true);
  });

  test('PATCH /api/settings → 401 toggling show_birth_year without auth', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ show_birth_year: true });
    expect(res.status).toBe(401);
  });

  test('PATCH /api/settings → 400 on non-boolean show_birth_year', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .set('Cookie', adminCookie)
      .send({ show_birth_year: 'yes' });
    expect(res.status).toBe(400);
  });

  test('PATCH /api/settings → 400 on non-boolean moderation_enabled', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .set('Cookie', adminCookie)
      .send({ moderation_enabled: 'yes' });
    expect(res.status).toBe(400);
  });

  test('PATCH /api/settings → 400 when no recognised setting provided', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .set('Cookie', adminCookie)
      .send({ nonsense: true });
    expect(res.status).toBe(400);
  });

  test('PATCH /api/settings → 404 when no tree row', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .patch('/api/settings')
      .set('Cookie', adminCookie)
      .send({ moderation_enabled: false });
    expect(res.status).toBe(404);
  });
});

describe('mutations.applyChange', () => {
  test('person/create inserts person (+ relationship when parent_id)', async () => {
    const client = createClientMock();
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 't1' }] }) // resolveTreeId
      .mockResolvedValueOnce({ rows: [{ id: 'p1', name_en: 'Ram' }] }) // insert person
      .mockResolvedValueOnce({ rows: [{ id: 'r1', parent_id: 'p0', child_id: 'p1' }] }); // insert rel
    const result = await applyChange(client, {
      op_type: 'create', entity: 'person', payload: { name_en: 'Ram', parent_id: 'p0' },
    });
    expect(result.before).toBeNull();
    expect(result.after.person.id).toBe('p1');
    expect(result.after.relationship.id).toBe('r1');
  });

  test('person/create without parent → no relationship', async () => {
    const client = createClientMock();
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 't1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', name_en: 'Ram' }] });
    const result = await applyChange(client, {
      op_type: 'create', entity: 'person', payload: { name_en: 'Ram' },
    });
    expect(result.after.relationship).toBeNull();
  });

  test('person/update returns before + after', async () => {
    const client = createClientMock();
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 'p1', name_en: 'Old' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'p1', name_en: 'New' }] });
    const result = await applyChange(client, {
      op_type: 'update', entity: 'person', target_id: 'p1', payload: { name_en: 'New' },
    });
    expect(result.before.name_en).toBe('Old');
    expect(result.after.name_en).toBe('New');
  });

  test('person/update on missing target throws NOT_FOUND', async () => {
    const client = createClientMock();
    client.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      applyChange(client, { op_type: 'update', entity: 'person', target_id: 'x', payload: { name_en: 'a' } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('person/delete captures person + relationships in before', async () => {
    const client = createClientMock();
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 'p1', name_en: 'Ram' }] }) // person
      .mockResolvedValueOnce({ rows: [{ id: 'r1' }] }) // relationships
      .mockResolvedValueOnce({ rows: [] }); // delete
    const result = await applyChange(client, { op_type: 'delete', entity: 'person', target_id: 'p1' });
    expect(result.before.person.id).toBe('p1');
    expect(result.before.relationships).toHaveLength(1);
    expect(result.after).toBeNull();
  });

  test('tree/update returns before + after', async () => {
    const client = createClientMock();
    client.query
      .mockResolvedValueOnce({ rows: [{ id: 't1', title_en: 'Old' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't1', title_en: 'New' }] });
    const result = await applyChange(client, {
      op_type: 'update', entity: 'tree', payload: { title_en: 'New' },
    });
    expect(result.after.title_en).toBe('New');
  });

  test('unsupported entity/op throws', async () => {
    await expect(
      applyChange(createClientMock(), { op_type: 'frob', entity: 'person' })
    ).rejects.toThrow();
  });
});

describe('mutations.withTransaction', () => {
  test('commits and returns the fn result', async () => {
    const result = await withTransaction(async (c) => {
      await c.query('SELECT 1');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(pool.__client.query).toHaveBeenCalledWith('BEGIN');
    expect(pool.__client.query).toHaveBeenCalledWith('COMMIT');
    expect(pool.__client.release).toHaveBeenCalled();
  });

  test('rolls back and rethrows on error', async () => {
    await expect(
      withTransaction(async () => { throw new Error('boom'); })
    ).rejects.toThrow('boom');
    expect(pool.__client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(pool.__client.release).toHaveBeenCalled();
  });
});

describe('changelog', () => {
  test('recordPending inserts a pending row', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', status: 'pending' }] });
    const row = await recordPending(null, {
      op_type: 'update', entity: 'person', target_id: 'p1',
      payload: { name_en: 'x' }, client_token: 'tok',
    });
    expect(row.status).toBe('pending');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO change_request/);
    expect(params).toContain('tok');
  });

  test('recordApplied inserts an applied row with serialized snapshots', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c2', status: 'applied' }] });
    const row = await recordApplied(null, {
      op_type: 'update', entity: 'person', target_id: 'p1',
      before_snapshot: { a: 1 }, after_snapshot: { a: 2 }, resolved_by: 'u1',
    });
    expect(row.status).toBe('applied');
    const [, params] = pool.query.mock.calls[0];
    expect(params).toContain(JSON.stringify({ a: 1 }));
  });

  test('summarize diffs create / delete / update', () => {
    expect(summarize(null, { x: 1 })).toMatchObject({ type: 'create' });
    expect(summarize({ x: 1 }, null)).toMatchObject({ type: 'delete' });
    expect(summarize({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual({
      type: 'update', changed: { b: { from: 2, to: 3 } },
    });
  });
});

describe('changes routes', () => {
  const CR_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const PID = 'pppppppp-pppp-pppp-pppp-pppppppppppp'.replace(/p/g, 'a');

  test('POST /api/changes → 201 pending', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 't1' }] }) // tree id
      .mockResolvedValueOnce({ rows: [{ id: 'c1', status: 'pending' }] }); // recordPending
    const res = await request(app)
      .post('/api/changes')
      .send({ op_type: 'update', entity: 'person', target_id: PID, payload: { name_en: 'New' }, client_token: 'tok' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'c1', status: 'pending' });
  });

  test('POST /api/changes → 400 on invalid op_type', async () => {
    const res = await request(app)
      .post('/api/changes')
      .send({ op_type: 'frob', entity: 'person', payload: {} });
    expect(res.status).toBe(400);
  });

  test('POST /api/changes → non-admin person payload is whitelisted before queuing', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 't1' }] }) // tree id
      .mockResolvedValueOnce({ rows: [{ id: 'c1', status: 'pending' }] }); // recordPending
    const res = await request(app)
      .post('/api/changes')
      .send({
        op_type: 'create', entity: 'person',
        payload: { name_en: 'X', notes: 'secret', birth_year: 1990, parent_id: PID },
        client_token: 'tok',
      });
    expect(res.status).toBe(201);
    const queuedPayloadJson = pool.query.mock.calls[1][1][4]; // toJson(payload) at $5
    expect(queuedPayloadJson).toContain('name_en');
    expect(queuedPayloadJson).toContain('parent_id'); // structural — preserved
    expect(queuedPayloadJson).not.toContain('notes');
    expect(queuedPayloadJson).not.toContain('birth_year');
  });

  test('GET /api/changes (queue) → 401 without auth, list with admin', async () => {
    const noAuth = await request(app).get('/api/changes');
    expect(noAuth.status).toBe(401);

    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', status: 'pending' }] });
    const res = await request(app).get('/api/changes').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/changes/applied → anonymized history with summary', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 'c1', op_type: 'update', entity: 'person', target_id: PID,
        before_snapshot: { name_en: 'Old' }, after_snapshot: { name_en: 'New' },
        status: 'applied', resolved_at: '2026-01-01',
      }],
    });
    const res = await request(app).get('/api/changes/applied');
    expect(res.status).toBe(200);
    expect(res.body[0].summary).toMatchObject({ type: 'update' });
    expect(res.body[0].resolved_by).toBeUndefined();
  });

  test('GET /api/changes/mine → 400 without token, rows with token', async () => {
    const noToken = await request(app).get('/api/changes/mine');
    expect(noToken.status).toBe(400);

    pool.query.mockResolvedValueOnce({ rows: [{ id: 'c1', status: 'pending' }] });
    const res = await request(app).get('/api/changes/mine?token=tok');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('POST /:id/reject → 200 when pending, 409 otherwise', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: CR_ID }] });
    const ok = await request(app).post(`/api/changes/${CR_ID}/reject`).set('Cookie', adminCookie);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ id: CR_ID, status: 'rejected' });

    pool.query.mockResolvedValueOnce({ rows: [] });
    const conflict = await request(app).post(`/api/changes/${CR_ID}/reject`).set('Cookie', adminCookie);
    expect(conflict.status).toBe(409);
  });

  test('POST /:id/approve → applies the change + marks row applied', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: CR_ID, status: 'pending', op_type: 'update', entity: 'person',
        target_id: PID, payload: { name_en: 'New' }, tree_id: 't1',
      }],
    });
    pool.__client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: PID, name_en: 'Old' }] }) // SELECT before
      .mockResolvedValueOnce({ rows: [{ id: PID, name_en: 'New' }] }) // UPDATE person
      .mockResolvedValueOnce({ rows: [] }) // UPDATE change_request
      .mockResolvedValueOnce({}); // COMMIT
    const res = await request(app).post(`/api/changes/${CR_ID}/approve`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: CR_ID, status: 'applied' });
  });

  test('POST /:id/approve → 409 when not pending', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: CR_ID, status: 'applied' }] });
    const res = await request(app).post(`/api/changes/${CR_ID}/approve`).set('Cookie', adminCookie);
    expect(res.status).toBe(409);
  });

  test('POST /:id/revert → restores before_snapshot + marks reverted', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: CR_ID, status: 'applied', op_type: 'update', entity: 'person',
        target_id: PID, before_snapshot: { id: PID, name_en: 'Old' },
        after_snapshot: { id: PID, name_en: 'New' }, tree_id: 't1',
      }],
    });
    pool.__client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: PID, name_en: 'New' }] }) // applyChange SELECT before
      .mockResolvedValueOnce({ rows: [{ id: PID, name_en: 'Old' }] }) // applyChange UPDATE
      .mockResolvedValue({ rows: [{ id: 'audit1' }] }); // UPDATE original + INSERT audit + COMMIT
    const res = await request(app).post(`/api/changes/${CR_ID}/revert`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: CR_ID, status: 'reverted' });
  });

  test('POST /:id/approve → 401 without auth', async () => {
    const res = await request(app).post(`/api/changes/${CR_ID}/approve`);
    expect(res.status).toBe(401);
  });
});
