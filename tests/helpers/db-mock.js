// Test helper: factory for a mock pg pool.
//
// Returns a mock that matches the shape of `src/db/client` (a pg.Pool):
//   - `query`   : jest.fn for direct pool queries
//   - `connect` : jest.fn resolving to a mock client `{ query, release }`
//                 so transactional flows (BEGIN/COMMIT via a pooled client,
//                 e.g. applyChange) can be unit-tested.
//
// Usage:
//   const { createDbMock } = require('./helpers/db-mock');
//   jest.mock('../src/db/client', () => require('./helpers/db-mock').createDbMock());
// or build one explicitly and inject it where a pool is expected.

function createClientMock() {
  return {
    query: jest.fn(),
    release: jest.fn(),
  };
}

function createDbMock() {
  const client = createClientMock();
  const pool = {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(client),
  };
  // Expose the client so tests can assert on transactional queries.
  pool.__client = client;
  return pool;
}

module.exports = { createDbMock, createClientMock };
