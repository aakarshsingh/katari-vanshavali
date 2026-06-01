# Resume

## Current State

- **Last completed phase:** Phase 4 — Tree + Person API Routes
- **Next phase:** Phase 5 — Relationships + Transliterate Routes
- **All phases 0–4 committed.**

## Key Context (do not re-debate)

- Stack: Express + PostgreSQL on Railway; vanilla JS frontend; no framework; no build step
- No local PostgreSQL. All DB-dependent verifications deferred to Railway (Phase 15).
- DB is mocked in tests: `jest.mock('../src/db/client', () => ({ query: jest.fn() }))`
- `server.js` has a `require.main` guard — Supertest imports work without triggering migrations.
- Mock pattern for Anthropic SDK (needed in Phase 5): `jest.mock('@anthropic-ai/sdk', () => ({ ... }))`

## Read First

1. `.state/execution_plan.md` — Phase 5 details
2. `.state/conventions.md`
3. `.state/architecture_decisions.md`

## Resume Prompt

> I'm building a Vanshavali (Indian family tree) web tool. Phases 0–4 are complete
> and committed. All decisions are locked in `.state/`. Run `/as-p5-execute` to
> implement **Phase 5 only** (Relationships + Transliterate Routes) from
> `.state/execution_plan.md`. No local DB — mock the DB in tests the same way
> Phase 4 did (`jest.mock('../src/db/client', ...)`). Do not implement Phase 6
> until Phase 5 is verified and approved.
