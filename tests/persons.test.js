const request = require('supertest');

process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/db/client', () => require('./helpers/db-mock').createDbMock());

const pool = require('../src/db/client');
const app = require('../server');
const { signToken } = require('../src/auth/credentials');

const TREE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PERSON_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ADMIN_COOKIE = `token=${signToken({ id: 'u1', username: 'admin' })}`;

// A fully-populated DB row.
const FULL_PERSON = {
  id: PERSON_ID, tree_id: TREE_ID, name_en: 'Ram', name_hi: 'राम',
  birth_year: 1950, death_year: 2010, spouse_en: 'Sita', spouse_birth_year: 1952,
  spouse_death_year: 2012, gender: 'M', notes: 'secret', death_year_hidden: false,
  spouse_death_year_hidden: false,
};

const FLAGS_OFF = { rows: [{ moderation_enabled: false, show_birth_year: false }] };

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
  pool.__client.query.mockReset();
  pool.__client.release.mockReset();
  pool.connect.mockResolvedValue(pool.__client);
});

describe('GET /api/tree serialization', () => {
  function mockTreeGet() {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: TREE_ID, title_en: 'T', show_birth_year: false }] })
      .mockResolvedValueOnce({ rows: [FULL_PERSON] })
      .mockResolvedValueOnce({ rows: [] });
  }

  it('public view: strips notes, birth years, and hide flags; keeps death year', async () => {
    mockTreeGet();
    const res = await request(app).get('/api/tree');
    expect(res.status).toBe(200);
    const p = res.body.persons[0];
    expect(p).not.toHaveProperty('notes');
    expect(p).not.toHaveProperty('birth_year');
    expect(p).not.toHaveProperty('spouse_birth_year');
    expect(p).not.toHaveProperty('death_year_hidden');
    expect(p).not.toHaveProperty('spouse_death_year_hidden');
    expect(p.death_year).toBe(2010); // not force-hidden → shown
    expect(p.name_en).toBe('Ram');
  });

  it('admin view: returns the full row including notes, birth year, and flags', async () => {
    mockTreeGet();
    const res = await request(app).get('/api/tree').set('Cookie', ADMIN_COOKIE);
    expect(res.status).toBe(200);
    const p = res.body.persons[0];
    expect(p.notes).toBe('secret');
    expect(p.birth_year).toBe(1950);
    expect(p).toHaveProperty('death_year_hidden');
  });
});

describe('POST /api/persons whitelist', () => {
  it('non-admin payload is reduced to whitelisted fields before insert', async () => {
    pool.query.mockResolvedValueOnce(FLAGS_OFF);
    pool.__client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: TREE_ID }] }) // resolveTreeId
      .mockResolvedValueOnce({ rows: [FULL_PERSON] }) // INSERT
      .mockResolvedValueOnce({ rows: [{ id: 'cr1' }] }) // recordApplied
      .mockResolvedValueOnce({}); // COMMIT
    const res = await request(app)
      .post('/api/persons')
      .send({ name_en: 'Ram', birth_year: 1950, notes: 'x' });
    expect(res.status).toBe(201);
    // The INSERT (3rd __client call) must not carry the non-whitelisted columns.
    const insertSql = pool.__client.query.mock.calls[2][0];
    expect(insertSql).toContain('name_en');
    expect(insertSql).not.toContain('birth_year');
    expect(insertSql).not.toContain('notes');
    // Response is public-serialized (no notes leaked).
    expect(res.body).not.toHaveProperty('notes');
  });
});

describe('PATCH /api/persons/:id whitelist + hide flags', () => {
  it('non-admin PATCH of only detail fields → 400 (whitelist drops them all)', async () => {
    const res = await request(app)
      .patch(`/api/persons/${PERSON_ID}`)
      .send({ birth_year: 1990, notes: 'x' });
    expect(res.status).toBe(400); // payload empty after whitelist
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('admin PATCH can set death_year_hidden', async () => {
    pool.query.mockResolvedValueOnce(FLAGS_OFF);
    pool.__client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [FULL_PERSON] }) // SELECT before
      .mockResolvedValueOnce({ rows: [{ ...FULL_PERSON, death_year_hidden: true }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 'cr1' }] }) // recordApplied
      .mockResolvedValueOnce({}); // COMMIT
    const res = await request(app)
      .patch(`/api/persons/${PERSON_ID}`)
      .set('Cookie', ADMIN_COOKIE)
      .send({ death_year_hidden: true });
    expect(res.status).toBe(200);
    const updateSql = pool.__client.query.mock.calls[2][0];
    expect(updateSql).toContain('death_year_hidden');
    expect(res.body.death_year_hidden).toBe(true); // admin sees the flag
  });

  it('rejects a non-boolean hide flag with 400', async () => {
    const res = await request(app)
      .patch(`/api/persons/${PERSON_ID}`)
      .set('Cookie', ADMIN_COOKIE)
      .send({ death_year_hidden: 'yes' });
    expect(res.status).toBe(400);
  });
});
