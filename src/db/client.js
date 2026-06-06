// Database pool. In production this is a real pg.Pool driven by DATABASE_URL.
// For local dev/testing, set USE_MOCK_DB=1 to swap in an in-memory pg-mem pool
// (see mock-pool.js + scripts/dev-mock.js). The production path is unchanged
// when the flag is absent.
let pool;

if (process.env.USE_MOCK_DB) {
  pool = require('./mock-pool').createMockPool();
} else {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

module.exports = pool;
