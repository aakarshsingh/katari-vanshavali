const request = require('supertest');

jest.mock('../src/db/client', () => ({ query: jest.fn() }));

const pool = require('../src/db/client');
const app = require('../server');

const TREE = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', title_en: 'Family Tree', title_hi: null };
const PERSON = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', tree_id: TREE.id, name_en: 'Ram', gender: 'M' };

beforeEach(() => jest.clearAllMocks());

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
  it('returns 200 with updated tree', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...TREE, title_en: 'Updated' }] });
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
  it('returns 201 with created person', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: TREE.id }] })
      .mockResolvedValueOnce({ rows: [PERSON] });
    const res = await request(app).post('/api/persons').send({ name_en: 'Ram' });
    expect(res.status).toBe(201);
    expect(res.body.name_en).toBe('Ram');
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
