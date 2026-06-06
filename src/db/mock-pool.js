// In-memory Postgres (pg-mem) for local dev/testing without a real database.
// Activated via USE_MOCK_DB (see client.js). Data is ephemeral — it resets on
// every restart. Never used in production.
//
// pg-mem implements few native Postgres functions, so we shim the ones our
// schema/queries rely on (gen_random_uuid, the pgcrypto extension, btrim).
const { newDb, DataType } = require('pg-mem');
const { v4: uuidv4 } = require('uuid');

let pool;

function createMockPool() {
  if (pool) return pool;

  const db = newDb();

  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    // impure → pg-mem must call this per row (otherwise one UUID is reused and
    // every insert collides on the primary key).
    impure: true,
    implementation: () => uuidv4(),
  });

  // btrim(text) — used by the title-normalisation migration.
  db.public.registerFunction({
    name: 'btrim',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (s) => (s == null ? s : String(s).trim()),
    impure: false,
  });

  // Let `CREATE EXTENSION IF NOT EXISTS pgcrypto` be a no-op.
  db.registerExtension('pgcrypto', () => {});

  const pg = db.adapters.createPg();
  pool = new pg.Pool();
  return pool;
}

module.exports = { createMockPool };
