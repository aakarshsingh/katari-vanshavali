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

// A fully-populated DB row. Both person and spouse are deceased so the public
// year-stripping matrix is exercised (years exist to strip/keep).
const FULL_PERSON = {
  id: PERSON_ID, tree_id: TREE_ID, name_en: 'Ram', name_hi: 'राम',
  birth_year: 1950, death_year: 2010, deceased: true,
  spouse_en: 'Sita', spouse_birth_year: 1952, spouse_death_year: 2012, spouse_deceased: true,
  gender: 'M', notes: 'secret', death_year_hidden: false, spouse_death_year_hidden: false,
};

// Tree gate flags read by treeFlags()/tree.js — both year toggles OFF by default.
const FLAGS_OFF = {
  rows: [{ moderation_enabled: false, show_years_deceased: false, show_birth_year_living: false }],
};

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
  pool.__client.query.mockReset();
  pool.__client.release.mockReset();
  pool.connect.mockResolvedValue(pool.__client);
});

describe('GET /api/tree serialization', () => {
  function mockTreeGet(treeFlags = {}) {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: TREE_ID, title_en: 'T', ...treeFlags }] })
      .mockResolvedValueOnce({ rows: [FULL_PERSON] })
      .mockResolvedValueOnce({ rows: [] });
  }

  it('public view (both toggles off): strips notes, all years, and hide flags', async () => {
    mockTreeGet({ show_years_deceased: false, show_birth_year_living: false });
    const res = await request(app).get('/api/tree');
    expect(res.status).toBe(200);
    const p = res.body.persons[0];
    expect(p).not.toHaveProperty('notes');
    expect(p).not.toHaveProperty('birth_year');
    expect(p).not.toHaveProperty('death_year'); // deceased + toggle off → stripped
    expect(p).not.toHaveProperty('spouse_birth_year');
    expect(p).not.toHaveProperty('spouse_death_year');
    expect(p).not.toHaveProperty('death_year_hidden');
    expect(p).not.toHaveProperty('spouse_death_year_hidden');
    expect(p.name_en).toBe('Ram');
  });

  it('public view (show_years_deceased on): deceased person shows birth + death', async () => {
    mockTreeGet({ show_years_deceased: true, show_birth_year_living: false });
    const res = await request(app).get('/api/tree');
    expect(res.status).toBe(200);
    const p = res.body.persons[0];
    expect(p.birth_year).toBe(1950);
    expect(p.death_year).toBe(2010);
    expect(p.spouse_birth_year).toBe(1952);
    expect(p.spouse_death_year).toBe(2012);
    expect(p).not.toHaveProperty('notes'); // notes still always private
  });

  it('admin view: returns the full row including notes, birth year, and flags', async () => {
    mockTreeGet({ show_years_deceased: false, show_birth_year_living: false });
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
    pool.query.mockResolvedValueOnce(FLAGS_OFF); // treeFlags (both toggles off)
    const res = await request(app)
      .patch(`/api/persons/${PERSON_ID}`)
      .send({ birth_year: 1990, notes: 'x' });
    expect(res.status).toBe(400); // payload empty after whitelist (years admin-only while toggle off)
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('non-admin PATCH with show_years_deceased ON → deceased years pass the whitelist', async () => {
    const FLAGS_DECEASED_ON = {
      rows: [{ moderation_enabled: false, show_years_deceased: true, show_birth_year_living: false }],
    };
    pool.query
      .mockResolvedValueOnce(FLAGS_DECEASED_ON) // treeFlags
      .mockResolvedValueOnce({ rows: [FULL_PERSON] }); // SELECT current (no-op guard)
    pool.__client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [FULL_PERSON] }) // SELECT before
      .mockResolvedValueOnce({ rows: [{ ...FULL_PERSON, death_year: 2011 }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 'cr1' }] }) // recordApplied
      .mockResolvedValueOnce({}); // COMMIT
    const res = await request(app)
      .patch(`/api/persons/${PERSON_ID}`)
      .send({ death_year: 2011, notes: 'still-private' }); // year allowed, notes still dropped
    expect(res.status).toBe(200);
    const updateSql = pool.__client.query.mock.calls[2][0];
    expect(updateSql).toContain('death_year'); // year written through the public path
    expect(updateSql).not.toContain('notes'); // notes remain admin-only
  });

  it('admin PATCH can set death_year_hidden', async () => {
    pool.query
      .mockResolvedValueOnce(FLAGS_OFF) // treeFlags
      .mockResolvedValueOnce({ rows: [FULL_PERSON] }); // SELECT current (no-op guard)
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

describe('PATCH /api/persons/:id no-op guard (Phase 2.24)', () => {
  it('unchanged fields → 200 with no UPDATE, no queue, no history', async () => {
    pool.query
      .mockResolvedValueOnce(FLAGS_OFF) // treeFlags
      .mockResolvedValueOnce({ rows: [FULL_PERSON] }); // SELECT current
    const res = await request(app)
      .patch(`/api/persons/${PERSON_ID}`)
      .set('Cookie', ADMIN_COOKIE)
      .send({ name_en: 'Ram', death_year_hidden: false }); // both equal current
    expect(res.status).toBe(200);
    expect(res.body.name_en).toBe('Ram');
    // No transaction → no UPDATE and no recordApplied history row.
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('an integer that equals the stored value (1950 vs "1950") is not a change', async () => {
    pool.query
      .mockResolvedValueOnce(FLAGS_OFF)
      .mockResolvedValueOnce({ rows: [FULL_PERSON] }); // birth_year: 1950
    const res = await request(app)
      .patch(`/api/persons/${PERSON_ID}`)
      .set('Cookie', ADMIN_COOKIE)
      .send({ birth_year: '1950' }); // string form of the same year
    expect(res.status).toBe(200);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('only the genuinely changed key is written when some fields match', async () => {
    pool.query
      .mockResolvedValueOnce(FLAGS_OFF)
      .mockResolvedValueOnce({ rows: [FULL_PERSON] });
    pool.__client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [FULL_PERSON] }) // SELECT before
      .mockResolvedValueOnce({ rows: [{ ...FULL_PERSON, name_en: 'Raman' }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 'cr1' }] }) // recordApplied
      .mockResolvedValueOnce({}); // COMMIT
    const res = await request(app)
      .patch(`/api/persons/${PERSON_ID}`)
      .set('Cookie', ADMIN_COOKIE)
      .send({ name_en: 'Raman', birth_year: 1950 }); // name changed, year unchanged
    expect(res.status).toBe(200);
    const updateSql = pool.__client.query.mock.calls[2][0];
    expect(updateSql).toContain('name_en');
    expect(updateSql).not.toContain('birth_year'); // unchanged key dropped from the UPDATE
  });

  it('404 when the target person does not exist', async () => {
    pool.query
      .mockResolvedValueOnce(FLAGS_OFF)
      .mockResolvedValueOnce({ rows: [] }); // SELECT current → none
    const res = await request(app)
      .patch(`/api/persons/${PERSON_ID}`)
      .set('Cookie', ADMIN_COOKIE)
      .send({ name_en: 'Whoever' });
    expect(res.status).toBe(404);
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
