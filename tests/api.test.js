const request = require('supertest');

process.env.ANTHROPIC_API_KEY = 'test-key'; // transliterate route requires it
process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/db/client', () => require('./helpers/db-mock').createDbMock());
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ text: '["राम","रम","रां"]' }],
      }),
    },
  }));
});

const pool = require('../src/db/client');
const app = require('../server');
const { signToken } = require('../src/auth/credentials');

const TREE = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', title_en: 'Family Tree', title_hi: null };
const PERSON = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', tree_id: TREE.id, name_en: 'Ram', gender: 'M' };
const REL_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const REL = { id: REL_ID, tree_id: TREE.id, parent_id: TREE.id, child_id: PERSON.id };

const MOD_OFF = { rows: [{ moderation_enabled: false }] };
const MOD_ON = { rows: [{ moderation_enabled: true }] };

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
  pool.__client.query.mockReset();
  pool.__client.release.mockReset();
  pool.connect.mockResolvedValue(pool.__client);
});

describe('GET /api/tree', () => {
  it('returns 200 with full tree state', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [TREE] })
      .mockResolvedValueOnce({ rows: [PERSON] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/tree');
    expect(res.status).toBe(200);
    expect(res.body.tree).toBeDefined();
    expect(Array.isArray(res.body.persons)).toBe(true);
  });
});

describe('PATCH /api/tree', () => {
  it('returns 200 with updated tree (moderation off → applied)', async () => {
    pool.query.mockResolvedValueOnce(MOD_OFF);
    pool.__client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [TREE] }) // updateTree SELECT before
      .mockResolvedValueOnce({ rows: [{ ...TREE, title_en: 'Updated' }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 'cr1' }] }) // recordApplied
      .mockResolvedValueOnce({}); // COMMIT
    const res = await request(app).patch('/api/tree').send({ title_en: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.tree.title_en).toBe('Updated');
  });

  it('returns 400 when title_en is empty string', async () => {
    const res = await request(app).patch('/api/tree').send({ title_en: '' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/persons', () => {
  it('returns 201 with created person (moderation off → applied)', async () => {
    pool.query.mockResolvedValueOnce(MOD_OFF);
    pool.__client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: TREE.id }] }) // resolveTreeId
      .mockResolvedValueOnce({ rows: [PERSON] }) // INSERT person
      .mockResolvedValueOnce({ rows: [{ id: 'cr1' }] }) // recordApplied
      .mockResolvedValueOnce({}); // COMMIT
    const res = await request(app).post('/api/persons').send({ name_en: 'Ram' });
    expect(res.status).toBe(201);
    expect(res.body.name_en).toBe('Ram');
  });

  it('returns 202 pending when moderation ON and not admin', async () => {
    pool.query
      .mockResolvedValueOnce(MOD_ON) // moderationOn
      .mockResolvedValueOnce({ rows: [{ id: TREE.id }] }) // tree id
      .mockResolvedValueOnce({ rows: [{ id: 'cr1', status: 'pending' }] }); // recordPending
    const res = await request(app).post('/api/persons').send({ name_en: 'Ram' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'pending', id: 'cr1' });
    expect(pool.connect).not.toHaveBeenCalled(); // no live write
  });

  it('returns 201 applied when moderation ON but caller is admin', async () => {
    pool.query.mockResolvedValueOnce(MOD_ON);
    pool.__client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: TREE.id }] }) // resolveTreeId
      .mockResolvedValueOnce({ rows: [PERSON] }) // INSERT person
      .mockResolvedValueOnce({ rows: [{ id: 'cr1' }] }) // recordApplied
      .mockResolvedValueOnce({}); // COMMIT
    const res = await request(app)
      .post('/api/persons')
      .set('Cookie', `token=${signToken({ id: 'u1', username: 'admin' })}`)
      .send({ name_en: 'Ram' });
    expect(res.status).toBe(201);
  });

  it('returns 400 when name_en is missing', async () => {
    const res = await request(app).post('/api/persons').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when birth_year is out of range', async () => {
    const res = await request(app).post('/api/persons').send({ name_en: 'Ram', birth_year: 500 });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/relationships', () => {
  it('returns 201 with created relationship (moderation off)', async () => {
    pool.query.mockResolvedValueOnce(MOD_OFF);
    pool.__client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ tree_id: TREE.id }] }) // parent lookup
      .mockResolvedValueOnce({ rows: [REL] }) // INSERT relationship
      .mockResolvedValueOnce({ rows: [{ id: 'cr1' }] }) // recordApplied
      .mockResolvedValueOnce({}); // COMMIT
    const res = await request(app)
      .post('/api/relationships')
      .send({ parentId: TREE.id, childId: PERSON.id });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('returns 400 when parentId is not a valid UUID', async () => {
    const res = await request(app)
      .post('/api/relationships')
      .send({ parentId: 'not-a-uuid', childId: PERSON.id });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/relationships/:id', () => {
  it('returns 200 with deleted id (moderation off)', async () => {
    pool.query.mockResolvedValueOnce(MOD_OFF);
    pool.__client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [REL] }) // SELECT before
      .mockResolvedValueOnce({ rows: [] }) // DELETE
      .mockResolvedValueOnce({ rows: [{ id: 'cr1' }] }) // recordApplied
      .mockResolvedValueOnce({}); // COMMIT
    const res = await request(app).delete(`/api/relationships/${REL_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(REL_ID);
  });
});

describe('POST /api/transliterate', () => {
  it('returns 200 with options array', async () => {
    const res = await request(app).post('/api/transliterate').send({ text: 'Ram' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.options)).toBe(true);
  });

  it('returns 400 when text is empty', async () => {
    const res = await request(app).post('/api/transliterate').send({ text: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when text exceeds 100 chars', async () => {
    const res = await request(app)
      .post('/api/transliterate')
      .send({ text: 'a'.repeat(101) });
    expect(res.status).toBe(400);
  });
});
