# Execution Plan: Vanshavali Builder

## Objective

Build a traditional Indian genealogical tree web tool (Express + PostgreSQL + vanilla JS SVG frontend) deployable on Railway, seeded from the grandfather's existing PDF.

## Current Baseline

Fresh repo. `package.json` exists (bare init). `docs/vanshavali.pdf` and `docs/sample.png` present. No source code, no tests, no DB schema.

## Rules

- One phase active at a time. Wait for architect approval before starting the next.
- Maintain style per `.state/conventions.md` (kebab-case files, camelCase vars, immutable data, <400 lines/file).
- No public-facing changes unless approved.
- No local PostgreSQL available. All DB-dependent verification steps are deferred to Railway deploy (Phase 15). `npm test` is the sole local verification for DB phases.
- 3-Strike Rule: 3 consecutive test/build/lint failures → STOP, document error, wait for architect.
- Commit only when architect asks. Stage with explicit file paths.
- Before starting a phase, assess session fit. Recommend splitting if too large.
- Self-hosted font files (woff2) are binary downloads — fetch from Google Fonts static CDN during execute, save to `public/fonts/`. Do not base64-inline in source.
- `docs/seed.json` is gitignored (contains family data). `docs/seed.json.example` with 2–3 dummy nodes may be committed for reference.

## Phase Summary

| Phase | Name | Status |
|-------|------|--------|
| 0 | Test Infrastructure + Full Package Setup | Completed |
| 1 | Project Config Files | Completed |
| 2 | Database Layer | Completed |
| 3 | Express Server + Health Check | Completed |
| 4 | Tree + Person API Routes | Completed |
| 5 | Relationships + Transliterate Routes | Completed |
| 6 | Seed Script + Seed Loader | Completed |
| 7 | Frontend Shell + Fonts + CSS | Completed |
| 8 | State Store + API Client | Completed |
| 9 | Tree Layout Algorithm + Unit Tests | Completed |
| 10 | SVG Tree Renderer + Decorative Border | Completed |
| 11 | Pan / Zoom / Scroll | Completed |
| 12 | Sidebar Form + Context Menu | Completed |
| 13 | Transliteration Chips | Completed |
| 14 | Export (PNG + PDF) | Completed |
| 15 | Railway Deploy + Smoke Test | Completed |
| 16 | README + Documentation | Completed |
| 17 | Auto-seed on First Boot | Completed |
| 9A | Amend — Layout: Ancestor Split + Focal Root | Completed |
| 10A | Amend — Renderer: Ancestor Strip + Spouse + Lang-Only Nodes | Completed |
| 11A | Amend — Pan/Zoom: Ctrl+Wheel Zoom, Plain Scroll = Pan | Completed |
| 12A | Amend — Context Menu: Remove Background Click | Completed |
| 18 | Initial View — Center on Bade Lal Singh | Completed |
| **— Pivot Round 2 (feedback 2026-06-01) — implemented, awaiting live UI test —** | | |
| R0 | Amend — Schema + API: spouse birth/death/gender fields | Completed |
| R1 | Amend — Node sizing: dynamic width + text wrapping | Completed |
| R2 | Amend — Paired couple boxes + marriage connector + colors | Completed |
| R3 | Amend — Compact layout tuning (fit more per page) | Completed |
| R4 | Amend — Ancestor lineage connector polish | Completed |
| R5 | Amend — Generation differentiation (banding + patriarch) | Completed |
| R6 | Amend — Title i18n (EN/HI header switch) | Completed |
| R7 | Amend — Node affordances: hover **+** (add child) & **edit** icon | Completed |
| R8 | Amend — Add form: parent dropdown | Completed |
| R9 | Amend — Export robust rewrite (canvg, self-hosted jsPDF) | Completed |
| R10 | Amend — Export dialog → popover anchored to button | Completed |
| R11 | Amend — Visible-interaction help hint | Completed |
| R12 | New — Minimap (toggleable) | Completed |
| R13 | Amend — README refresh + layout tests | Completed |
| **— Pivot Round 4 (feedback 2026-06-02) — pending —** | | |
| R4-1 | Schema + API: `sequence` column + validator + allow-list | Completed |
| R4-2 | Form: move Living above Birth/Death; add Sequence input | Completed |
| R4-3 | Sidebar: read/write `sequence` | Completed |
| R4-4 | Sibling ordering in `buildAdjacency` + layout tests | Completed |

---

## Phase Details

### Phase 0: Test Infrastructure + Full Package Setup

**Status:** Completed

**Scope note:** Minimal harness only. Two test files: layout algorithm unit tests (pure function, highest value) and API smoke tests (does the server respond, not exhaustive coverage). No coverage targets enforced in v1.

**Target Files:**
- `package.json` — modify (add all prod + dev deps; npm scripts)
- `jest.config.js` — create
- `tests/tree-layout.test.js` — create (placeholder: 1 passing test)
- `tests/api.test.js` — create (placeholder: 1 passing test)

**Changes:**
- `package.json` prod deps: `express`, `pg`, `uuid`, `@anthropic-ai/sdk`
- `package.json` devDeps: `jest`, `supertest`
- `package.json` scripts:
  - `"start": "node server.js"`
  - `"migrate": "node src/db/migrate.js"`
  - `"seed": "node src/db/seed.js"`
  - `"seed:pdf": "node scripts/seed-pdf.js"`
  - `"test": "jest"`
- `jest.config.js`: testEnvironment `node` only — no coverage config needed for v1
- Placeholder tests: `test('placeholder', () => expect(true).toBe(true))`

**Verification:**
- [ ] `npm install` exits 0
- [ ] `npm test` passes with 2 placeholder tests

**Definition of Done:**
- [ ] All deps installed with no audit criticals
- [ ] `npm test` green

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary

**Completion Record:**
- Implementation notes: Added express, pg, uuid, @anthropic-ai/sdk as prod deps; jest, supertest as devDeps. Kept existing pdf-parse (needed for Phase 6). jest.config.js uses testEnvironment:node only. Two placeholder test files created, both pass.
- Deviations from plan: None.
- Field notes: 1 moderate audit vulnerability (in pdf-parse transitive dep) — no criticals.

---

### Phase 1: Project Config Files

**Status:** Pending

**Target Files:**
- `.gitignore` — create
- `.env.example` — create
- `railway.toml` — create

**Changes:**
- `.gitignore`: `node_modules/`, `.env`, `docs/seed.json`, `coverage/`
- `.env.example`:
  ```
  DATABASE_URL=postgresql://user:pass@host:5432/dbname
  ANTHROPIC_API_KEY=sk-ant-...
  PORT=3000
  ```
- `railway.toml`:
  ```toml
  [deploy]
  startCommand = "npm run migrate && npm start"
  healthcheckPath = "/health"
  ```

**Verification:**
- [x] `.gitignore` ignores `node_modules` and `.env` (verify with `git status`)
- [x] `.env.example` contains all 3 required keys

**Definition of Done:**
- [ ] All three files exist with correct content
- [ ] `git status` does not show `node_modules` or `.env` as untracked

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary

**Completion Record:**
- Implementation notes: All three files created exactly per plan. `.gitignore` confirmed working via `git status` — node_modules and .env absent from untracked list.
- Deviations from plan: None.
- Field notes: None.

---

### Phase 2: Database Layer

**Status:** Pending

**Target Files:**
- `src/db/client.js` — create
- `src/db/migrate.js` — create

**Changes:**
- `src/db/client.js`: export a `pg.Pool` using `process.env.DATABASE_URL`; set `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`
- `src/db/migrate.js`: `CREATE TABLE IF NOT EXISTS` for `tree`, `person`, `relationship` per the data model in `requirements.md`; use UUIDs (`gen_random_uuid()`); call `client.end()` after migration; export `runMigrations()` for use by server.js

**Schema (exact DDL):**
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tree (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en TEXT NOT NULL DEFAULT 'Family Tree',
  title_hi TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS person (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES tree(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_hi TEXT,
  birth_year INTEGER,
  death_year INTEGER,
  spouse_en TEXT,
  spouse_hi TEXT,
  gender TEXT CHECK (gender IN ('M','F','other')) DEFAULT 'M',
  notes TEXT,
  x_pos FLOAT DEFAULT 0,
  y_pos FLOAT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS relationship (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES tree(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  UNIQUE(parent_id, child_id)
);
```

**Verification:**
- [ ] `DATABASE_URL=<local-pg> node src/db/migrate.js` exits 0 and creates all 3 tables
- [ ] `npm test` still passes (no regressions)

**Definition of Done:**
- [ ] All 3 tables created in local dev DB
- [ ] `migrate.js` is idempotent (safe to run twice)

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary

**Completion Record:**
- Implementation notes: Both files created per plan. pool uses `process.env.DATABASE_URL`. `runMigrations()` exported for server.js; `require.main` guard runs it standalone. Migration verification deferred to Railway deploy — no local DB available.
- Deviations from plan: None.
- Field notes: All phases that require a live DB will be verified on Railway in Phase 15.

---

### Phase 3: Express Server + Health Check

**Status:** Pending

**Target Files:**
- `server.js` — create

**Changes:**
- Import Express, `src/db/migrate.js`, route files (stubs for now — mount after Phase 4/5)
- On startup: call `runMigrations()`, then `app.listen(PORT)`
- `GET /health` → `{ status: 'ok' }`
- `app.use(express.static('public'))`
- `app.use(express.json())`
- Graceful error logging (no stack traces exposed to client)

**Verification:**
- [ ] `node server.js` starts without error (requires DATABASE_URL set in `.env`)
- [ ] `curl http://localhost:3000/health` returns `{"status":"ok"}`
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] Server starts and serves health check
- [ ] Migration runs automatically on startup

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary

**Completion Record:**
- Implementation notes: server.js created per plan. Exports `app` for Supertest use in Phase 4 tests. `node server.js` + curl verification deferred to Railway (no local DB).
- Deviations from plan: None.
- Field notes: `module.exports = app` added so Phase 4 api.test.js can import it for Supertest without starting a real server.

---

### Phase 4: Tree + Person API Routes

**Status:** Pending

**Target Files:**
- `src/middleware/validate.js` — create
- `src/routes/tree.js` — create
- `src/routes/persons.js` — create
- `server.js` — modify (mount `/api/tree` and `/api/persons`)
- `tests/api.test.js` — modify (replace placeholder with real tests)

**Changes:**
- `validate.js`: `requireName(req,res,next)`, `requireValidYear(field)`, `requireUUID(field)` — return 400 with `{error: '...'}` on failure
- `tree.js`:
  - `GET /api/tree` → returns `{tree, persons[], relationships[]}` (full state snapshot); creates a default tree row if none exists
  - `PATCH /api/tree` → update `title_en` / `title_hi`; validate non-empty string
- `persons.js`:
  - `POST /api/persons` → validate name_en required, year range 1000–2100; insert; return created person
  - `PATCH /api/persons/:id` → partial update (only fields present in body); validate UUID param
  - `DELETE /api/persons/:id` → delete person + cascade handled by DB; return `{deleted: id}`
- `tests/api.test.js`: minimal Supertest smoke tests — GET /api/tree returns 200, POST /api/persons with valid body returns 201, POST with missing name_en returns 400, PATCH /api/tree returns 200. No exhaustive coverage.

**Verification:**
- [ ] `npm test` passes
- [ ] `curl -X POST .../api/persons -d '{"name_en":"Ram"}'` returns created person JSON
- [ ] `curl -X POST .../api/persons -d '{}'` returns 400 with error message

**Definition of Done:**
- [ ] All tree + person routes working; smoke tests pass

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary

**Completion Record:**
- Implementation notes: All routes and middleware created per plan. server.js updated with `require.main` guard and route mounts. Tests mock `../src/db/client` with `jest.fn()` — no live DB needed. 7 tests pass. curl verification deferred to Railway.
- Deviations from plan: Added `require.main` guard to server.js (needed for Supertest to work without DB). Minor addition — no architectural change.
- Field notes: All future api.test.js additions should mock `../src/db/client` the same way.

---

### Phase 5: Relationships + Transliterate Routes

**Status:** Completed

**Target Files:**
- `src/routes/relationships.js` — create
- `src/routes/transliterate.js` — create
- `server.js` — modify (mount both routes)
- `tests/api.test.js` — modify (add relationship + transliterate tests)

**Changes:**
- `relationships.js`:
  - `POST /api/relationships` → body `{parentId, childId}`; validate both UUIDs; enforce no duplicate; insert; return created row
  - `DELETE /api/relationships/:id` → validate UUID; delete; return `{deleted: id}`
- `transliterate.js`:
  - `POST /api/transliterate` → body `{text: string}`; validate non-empty string ≤ 100 chars
  - Call Claude Haiku via `@anthropic-ai/sdk`: prompt asks for JSON array of 3–5 Devanagari transliterations
  - Parse response; return `{options: string[]}`; on Claude error return 502 with `{error: '...'}`
  - System prompt: `"You are a transliteration assistant. Return only a JSON array of 3-5 Devanagari script transliterations for the given name. No explanation."`
- `tests/api.test.js`: add smoke tests — POST /api/relationships returns 201, DELETE returns 200, POST /api/transliterate with mocked Anthropic SDK returns `{options:[...]}`. Minimal only.

**Verification:**
- [ ] `npm test` passes (Anthropic SDK mocked in tests)
- [ ] Manual: `curl -X POST .../api/transliterate -d '{"text":"Ram"}'` returns `{options:[...]}`

**Definition of Done:**
- [ ] All 4 route files complete, mounted, and smoke-tested

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary

**Completion Record:**
- Implementation notes: `relationships.js` reuses existing `requireUUID` middleware for body-field UUID validation (it checks `req.params[field]` then falls through to `req.body[field]`). `transliterate.js` wraps Anthropic SDK with nested try/catch to distinguish JSON-parse failures (502) from Claude API failures (502). Both routes mounted in `server.js`. Anthropic SDK mocked in tests via `jest.mock('@anthropic-ai/sdk')` with a fixed response `["राम","रम","रां"]`.
- Deviations from plan: None.
- Field notes: `requireUUID` from Phase 4 middleware supports body fields via params→body fallback — no new middleware needed for relationship body UUIDs.

---

### Phase 6: Seed Script + Seed Loader

**Status:** Completed

**Target Files:**
- `scripts/seed-pdf.js` — create
- `src/db/seed.js` — create

**Changes:**
- `scripts/seed-pdf.js`:
  1. Read `docs/vanshavali.pdf` as binary
  2. Convert page 1 to PNG using `canvas` npm pkg (install as devDep)
  3. Base64-encode PNG
  4. Send to Claude Vision (claude-sonnet-4-6 or claude-opus-4-8 — vision capable) with prompt:
     ```
     Extract all people and parent-child relationships from this family tree image.
     Return a JSON object: { "title_en": "...", "title_hi": "...", "persons": [{
       "id": "p1", "name_en": "...", "name_hi": "...", "birth_year": null,
       "death_year": null, "spouse_en": "...", "spouse_hi": "...", "gender": "M"
     }], "relationships": [{"parent_id": "p1", "child_id": "p2"}] }
     Use short stable IDs like p1, p2, p3. Extract Hindi names from Devanagari text.
     If a field is unclear, use null.
     ```
  5. Write response JSON to `docs/seed.json`
- `src/db/seed.js`:
  1. Read `docs/seed.json`
  2. Open DB connection
  3. Insert/upsert tree row (title_en, title_hi)
  4. Insert all persons (replace short IDs with UUIDs; build ID map)
  5. Insert all relationships using UUID ID map
  6. Log count of inserted records; close connection

**Verification:**
- [ ] `node scripts/seed-pdf.js` exits 0 and writes `docs/seed.json` with ≥ 5 persons
- [ ] `npm run seed` exits 0 and inserts records into DB
- [ ] `GET /api/tree` returns the seeded data
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] `docs/seed.json` generated and correct
- [ ] DB populated; full tree visible via API

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary

**Completion Record:**
- Implementation notes: `seed-pdf.js` sends the raw PDF as a base64 `document` block to claude-opus-4-8; extracts JSON via regex in case Claude wraps response in markdown. `seed.js` checks for existing tree before inserting, maps short IDs (p1, p2) to UUIDs, guards re-runs with `ON CONFLICT DO NOTHING`, and warns (does not fail) on relationships that reference unknown IDs. `npm test` passes (13/13). `node scripts/seed-pdf.js` and `npm run seed` deferred — require `ANTHROPIC_API_KEY` and live DB respectively (same deferral pattern as prior phases).
- Deviations from plan: **canvas not used.** The plan specified "Convert page 1 to PNG using `canvas` npm pkg." `canvas` (node-canvas) is a drawing library with no PDF-parsing capability; pairing with `pdfjs-dist` would add a brittle native dependency. Used Anthropic's native PDF `document` content type instead — SDK v0.52.0 supports it, no conversion step needed, no new deps.
- Field notes: `scripts/` directory did not exist; created implicitly via file write. `seed-pdf.js` uses regex `/\{[\s\S]*\}/` to extract JSON from Claude's response in case it adds markdown fencing.

---

### Phase 7: Frontend Shell + Fonts + CSS

**Status:** Completed

**Target Files:**
- `public/index.html` — create
- `public/css/main.css` — create
- `public/css/sidebar.css` — create
- `public/fonts/NotoSansDevanagari-Regular.woff2` — create (download)
- `public/fonts/NotoSansDevanagari-Bold.woff2` — create (download)

**Changes:**
- Icons: use **Lucide Icons** via CDN (`<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js">`); call `lucide.createIcons()` after DOM load. Lucide is MIT, ~50 KB, no build step needed.
- Icon assignments:
  - Zoom In → `zoom-in`, Zoom Out → `zoom-out`, Fit → `maximize-2`, Export → `download`
  - EN/HI toggle → `languages`, Title edit area → `pencil` hint icon beside it
  - Sidebar Add → `user-plus`, Save → `check`, Close → `x`
  - Context menu: Add Child → `git-branch`, Edit → `pencil`, Delete → `trash-2`
- `index.html` structure:
  ```
  <header> toolbar: [🌐 EN|HI] [🔍+ Zoom In] [🔍- Zoom Out] [⛶ Fit] [⬇ Export]
           [contenteditable title span with ✏ hint]
  <main>
    <div id="tree-viewport">   ← overflow: auto; width/height: 100%
      <svg id="tree-svg">      ← grows to fit tree; starts 2000×1500
    </div>
    <aside id="sidebar">       ← position: fixed right; hidden initially
  </main>
  <dialog id="export-dialog">  ← format radio + language radio + Confirm
  ```
- `main.css`: vintage cream background (`#fdf6e3`), dark ink text (`#1a1008`), serif heading font, `@font-face` for both Noto Sans Devanagari woff2 files, grid layout header+main
- `sidebar.css`: fixed right panel 320px, slide-in transition, chip styles (small pill buttons, ink border), form field styles
- Font files: download `NotoSansDevanagari-Regular.woff2` and `NotoSansDevanagari-Bold.woff2` from Google Fonts static URLs during execute

**Verification:**
- [ ] `node server.js` + visit `http://localhost:3000` → styled shell visible (no JS errors in console)
- [ ] Noto Sans Devanagari loads: type `वंशावली` in browser console devtools — font renders correctly
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] Shell visible with toolbar, empty SVG viewport, hidden sidebar, export dialog accessible
- [ ] Font files present in `public/fonts/`

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary

**Completion Record:**
- Implementation notes: All 5 target files created. HTML shell matches plan structure (header/toolbar, tree-viewport SVG, sidebar, ctx-menu div, export dialog). Lucide icons via CDN; `lucide.createIcons()` called after scripts load. CSS uses CSS custom properties for all colours and sidebar width. Sidebar slide-in via `transform: translateX(100%)` → `.open` class. Font files downloaded from Google Fonts static CDN (v30). Browser verification deferred — requires DB for `node server.js` startup.
- Deviations from plan: None.
- Field notes: Google Fonts serves a single variable woff2 for all Noto Sans Devanagari weights; Regular and Bold files are byte-for-byte identical. The @font-face declarations in main.css differentiate by font-weight so the browser uses the correct weight from the variable font.

---

### Phase 8: State Store + API Client

**Status:** Completed

**Target Files:**
- `public/js/main.js` — create
- `public/js/api.js` — create

**Changes:**
- `api.js`: fetch wrappers (`getTree`, `patchTree`, `createPerson`, `updatePerson`, `deletePerson`, `createRelationship`, `deleteRelationship`, `transliterate`); all return plain objects; throw on non-2xx
- `main.js`:
  - `state = Object.freeze({tree, persons[], relationships[], lang: 'en'})` — never mutated
  - `setState(partial)` → returns new frozen state; calls `renderTree(newState)` (stub for now)
  - `init()`: calls `api.getTree()` → `setState()`; if empty shows helper prompt
  - Lang toggle button handler: `setState({lang: state.lang === 'en' ? 'hi' : 'en'})`
  - Script tag order in index.html: api.js → main.js (add `<script>` tags)

**Verification:**
- [ ] Browser console shows `Tree loaded: N persons` on page load (seeded data)
- [ ] Lang toggle button switches `state.lang` (verify in console: `window.__state.lang`)
- [ ] Empty DB (drop + remigrate): page shows helper prompt text
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] State loads from API on init; lang toggle works; empty state handled

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary

**Completion Record:**
- Implementation notes: `api.js` — all 8 fetch wrappers; `apiFetch` throws on non-2xx with `err.status` set. `main.js` — immutable state via `Object.freeze`; `setState` spreads partial into new frozen state and calls `renderTree` if defined; `init()` loads tree from API, logs count, calls `showEmptyHint` on empty or error. Title edit wires `blur`/`keydown` with API call and revert on error. Export dialog wires to `doExport` if defined. Both `renderTree` and `doExport` guarded with `typeof` check — safe to load before Phase 10/14. `window.__state` exposed. Browser verification deferred (requires DB).
- Deviations from plan: None.
- Field notes: Script tags for all JS modules already present in index.html from Phase 7.

---

### Phase 9: Tree Layout Algorithm + Unit Tests

**Status:** Completed

**Target Files:**
- `public/js/tree-layout.js` — create
- `tests/tree-layout.test.js` — modify (replace placeholder with real tests)

**Changes:**
- `tree-layout.js`: export `computeLayout(persons, relationships)` → `{id, x, y}[]`
  - Build adjacency: find root (person with no parent in relationships)
  - Recursive Reingold-Tilford: assign preliminary x, compute left contours, shift subtrees to avoid overlap, final x = prelim + mod accumulator
  - Node dimensions: width=160, height=70, hGap=24, vGap=60
  - Y = depth × (height + vGap); X = Reingold-Tilford
  - Returns array of `{id, x, y, width, height}` — pure function, no DOM
- `tests/tree-layout.test.js`: 3 focused cases only:
  - Single node → returns 1 position at `{x:0, y:0}`
  - Linear chain (A→B→C) → 3 nodes with strictly increasing y
  - Wide siblings (parent with 4 children) → no x bounding-box overlap between siblings

**Verification:**
- [ ] `npm test` passes with all 3 layout tests

**Definition of Done:**
- [ ] Layout algorithm correct for all 3 cases; pure function (no DOM access)

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary

**Completion Record:**
- Implementation notes: Reingold-Tilford two-pass algorithm. First pass assigns preliminary x positions bottom-up, shifting subtrees right to avoid overlap using left/right contour functions. Second pass accumulates modifiers top-down for final (x, y). Y = depth × (NODE_HEIGHT + V_GAP). Final x shifted so leftmost node is at x=0. `module.exports` guarded with `typeof module !== 'undefined'` for browser/Node compatibility.
- Deviations from plan: None.
- Field notes: Contour functions use recursive subtree traversal rather than thread pointers (classic RT optimization) — simpler and sufficient for typical family tree sizes (<200 nodes).

---

### Phase 10: SVG Tree Renderer + Decorative Border

**Status:** Completed

**Target Files:**
- `public/js/tree-render.js` — create

**Changes:**
- `renderTree(state)`: called by `main.js`; clears and redraws `#tree-svg`
  - Call `computeLayout(state.persons, state.relationships)` → positions
  - Resize SVG `width`/`height` to fit all nodes + padding (80 px all sides)
  - Decorative border: outermost `<rect>` inset 8px, double stroke effect (two nested `<rect>` elements, ink colour, no fill, corner-radius 4)
  - Edges: `<path>` elbow connectors (vertical from parent bottom → horizontal → vertical to child top); ink colour; stroke-width 1.5
  - Nodes: `<g class="node" data-id="..." data-name-en="..." data-name-hi="...">` containing:
    - `<rect>` fill: `#fff8f0` (male/other) or `#8b1a1a` (female, matching sample red); stroke ink; rx 3
    - `<text class="name-primary">` — current lang name, centred, bold, 13px
    - `<text class="name-secondary">` — other lang name, centred, 10px, muted
    - `<text class="years">` — `birth_year – death_year` if present, 9px
  - Lang display: if `state.lang === 'hi'`: primary=name_hi||name_en, secondary=name_en; else reverse
  - Attach click handler per node (→ sidebar.js, Phase 12)
  - Attach contextmenu handler per node (→ context-menu.js, Phase 12)
  - Expose `renderTree` on `window` for `main.js` to call

**Verification:**
- [ ] Reload browser with seeded DB → full tree renders with Hindi + English names
- [ ] Female nodes have warm red fill; male nodes cream
- [ ] Decorative double border visible around tree
- [ ] Lang toggle re-renders tree swapping primary/secondary names
- [x] `npm test` still passes

**Definition of Done:**
- [ ] Tree renders correctly for seeded data in both EN and HI modes (browser verification deferred to Railway)

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary

**Completion Record:**
- Implementation notes: `renderTree` clears SVG on each call and re-renders from scratch. Double border: outer rect stroke-width 1.5, inner rect stroke-width 0.75, both rx=4. Elbow connectors use `M px py V midY H cx V cy` path. Node text y-positions shift upward when years are present to keep all 3 lines vertically centred. Female nodes: dark red fill `#8b1a1a` with light text; male/other: cream `#fff8f0` with ink text. Click → `openEdit(id)` if defined; contextmenu → `showCtxMenu(e, id)` if defined (both stubs until Phase 12).
- Deviations from plan: None.
- Field notes: Browser verification deferred — requires live DB for server startup (same pattern as Phases 3–8).

---

### Phase 11: Pan / Zoom / Scroll

**Status:** Completed

**Target Files:**
- `public/js/canvas.js` — create

**Changes:**
- `canvas.js` wraps `#tree-viewport` (overflow:auto) and `#tree-svg`:
  - **Scroll**: native scrollbars on `#tree-viewport` (already handled by CSS `overflow:auto`)
  - **Zoom**: track `scale` (default 1.0, min 0.3, max 2.0); apply `transform: scale(scale)` with `transform-origin: 0 0` on `#tree-svg`; adjust SVG container size so scrollbars remain accurate
  - Zoom In / Zoom Out buttons: step ±0.15
  - Mouse wheel on viewport: `event.deltaY` → adjust scale
  - **Fit**: compute scale to fit entire SVG in viewport; scroll to top-left
  - **Pan via drag**: mousedown on SVG background (not a node) → set dragging flag; mousemove → update `scrollLeft`/`scrollTop` of viewport; mouseup → clear flag; cursor: grab/grabbing
  - Expose `initCanvas()` called by `main.js`

**Verification:**
- [ ] Zoom In / Out buttons change tree scale
- [ ] Mouse wheel zooms
- [ ] Fit button fits entire tree in viewport
- [ ] Drag on empty canvas area pans (scrollbars update accordingly)
- [ ] Clicking a node does NOT trigger pan (event target check)
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] All pan/zoom/scroll interactions work without layout glitches

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary

**Completion Record:**
- Implementation notes: Scale state is module-level (single canvas instance). `applyScale` uses CSS `transform: scale()` with `transform-origin: 0 0` and expands the SVG's inline width/height so the viewport's native scrollbars track the scaled size correctly. Wheel listener uses `{ passive: false }` to allow `preventDefault()`. Pan: mousedown/mousemove/mouseup — move and up handlers attached to `window` so drag isn't lost if cursor exits the SVG. `isNodeTarget` uses `closest('.node')` to guard pan from node clicks. Cursor set to `grab` on SVG background, `grabbing` while dragging.
- Deviations from plan: `initCanvas()` self-initializes via `DOMContentLoaded` rather than being called from `main.js` (main.js is not in the target file list). `window.initCanvas` is also exposed for explicit calls. Functionally equivalent.
- Field notes: Browser verification deferred — requires live DB.

---

### Phase 12: Sidebar Form + Context Menu

**Status:** Completed

**Target Files:**
- `public/js/sidebar.js` — create
- `public/js/context-menu.js` — create

**Changes:**
- `sidebar.js`:
  - `openNew(parentId|null)`: clear form, set mode=new, set parentId
  - `openEdit(personId)`: populate form with person data, set mode=edit
  - `close()`: hide sidebar
  - Form fields: name_en (required), name_hi, birth_year, death_year, spouse_en, spouse_hi, gender (radio M/F/other), notes
  - Submit handler:
    - mode=new: `api.createPerson({...})` → if parentId: `api.createRelationship(...)` → `main.setState(...)` → `renderTree(...)`
    - mode=edit: `api.updatePerson(id, {...})` → `main.setState(...)` → `renderTree(...)`
  - Delete button (edit mode only): confirm dialog → `api.deletePerson(id)` → `api.deleteRelationship(...)` → update state
  - Single-root guard in openNew(null): if `state.persons.length > 0`, show inline error "Tree already has a root. Use 'Add Child' on an existing node."
  - Hooks for `transliterate.js` (Phase 13): expose `onNameInput` callback slot on name_en + spouse_en fields
- `context-menu.js`:
  - Custom `<div id="ctx-menu">` hidden by default; positioned at click coordinates
  - Show on node `contextmenu` event (prevent default browser menu)
  - Items with Lucide icons: **`<git-branch>` Add Child** → `sidebar.openNew(nodeId)`, **`<pencil>` Edit** → `sidebar.openEdit(nodeId)`, **`<trash-2>` Delete** → confirm → delete flow
  - Hide on click outside or Escape key
  - `canvas.js` background click → `sidebar.openNew(null)` (after guard)

**Verification:**
- [ ] Right-click node → custom menu appears at cursor
- [ ] Add Child → sidebar opens with parentId set; submit → new node appears in tree
- [ ] Edit → sidebar opens pre-filled; changes persist on reload
- [ ] Delete → node + relationships removed from tree and DB
- [ ] Background click with empty tree → new root form opens
- [ ] Background click with existing tree → error message shown inline
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] Full CRUD cycle working end-to-end in browser with DB persistence

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary

**Completion Record:**
- Implementation notes: `sidebar.js` — `getSidebarEls()` called per-action (avoids stale refs). State updates use spread into new arrays (immutable). `finally` block re-enables save button on both success and error. Phase 13 hook: calls `attachTransliterate(nameEn, nameHi)` once on init if defined. `context-menu.js` — uses `style.display` for show/hide (works with existing `hidden` attr). `ctxNodeId` captured at show time, safe if menu stays open across re-renders. SVG background click attached in context-menu.js (canvas.js not in target list).
- Deviations from plan: SVG background click → `openNew(null)` wired in `context-menu.js` rather than `canvas.js` (canvas.js not a Phase 12 target). `api.createPerson` response expected as `{ person }` — matches Phase 4 route return shape.
- Field notes: Browser verification deferred (requires live DB).

---

### Phase 13: Transliteration Chips

**Status:** Completed

**Target Files:**
- `public/js/transliterate.js` — create

**Changes:**
- `transliterate.js`: export `attachTransliterate(inputEl, outputEl)`:
  - `inputEl`: the English name/spouse input
  - `outputEl`: the Hindi name/spouse input
  - Internal `Map<string, string[]>` cache (module-level, shared across both field pairs)
  - On `inputEl` keyup: debounce 600 ms
    - If cached: render chips immediately
    - Else: show spinner in chip area → `POST /api/transliterate` → cache result → render chips
  - Chip render: clear chip container; append `<button class="chip">` per option; click → set `outputEl.value = option`; remove spinner
  - On `inputEl` blur with empty value: clear chips
  - Wire up in `sidebar.js`: call `attachTransliterate(nameEnInput, nameHiInput)` and `attachTransliterate(spouseEnInput, spouseHiInput)` after sidebar DOM ready

**Verification:**
- [ ] Type "Ram" in name_en field → spinner appears → 3–5 chips appear → click one → name_hi populated
- [ ] Type "Ram" again → chips appear immediately (cache hit, no network request in DevTools)
- [ ] Spouse field has same chip behaviour independently
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] Chips work for both name and spouse fields; cache prevents duplicate API calls

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary

**Completion Record:**
- Implementation notes: Single file `public/js/transliterate.js` created. Module-level `_transCache` Map shared across both `attachTransliterate` call sites. Each invocation gets its own `debounceTimer` closure. Chip container resolved via `outputEl.nextElementSibling` (the `.chip-row` div that follows each Hindi input in the HTML). On keyup: debounce 600 ms → cache hit renders immediately, cache miss shows spinner then fetches. On blur with empty value: chips cleared. Click on chip sets `outputEl.value`. `window.attachTransliterate` exposed for `sidebar.js` typeof guard. `npm test` 15/15 pass.
- Deviations from plan: None.
- Field notes: `_transCache` prefixed with `_` to signal module-private intent and avoid global namespace collision.

---

### Phase 14: Export (PNG + PDF)

**Status:** Completed

**Target Files:**
- `public/js/export.js` — create
- `public/index.html` — modify (add `<script src="https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js">` or local copy; wire Export button)

**Changes:**
- `export.js`: `doExport({format, lang})`:
  1. Clone `#tree-svg` as a detached SVG element
  2. If lang=en: remove all `.name-hi` text elements from clone; if lang=hi: remove `.name-en`
  3. Inject Noto Sans Devanagari base64 `@font-face` as `<style>` inside clone's `<defs>` (font file read at build-time and stored as a JS const — read woff2 file via fetch('/fonts/NotoSansDevanagari-Regular.woff2') on first export, cache as base64)
  4. Serialize clone to string → Blob URL
  5. Draw to off-screen `<canvas>` at 2× pixel ratio via `new Image()` → `ctx.drawImage()`
  6. PNG: `canvas.toBlob('image/png')` → create anchor → `.click()` → download `vanshavali.png`
  7. PDF (jsPDF):
     - `new jsPDF({orientation:'landscape', unit:'mm', format:'a3'})`
     - Add tree image centred on page with padding
     - Title block: `doc.setFont('helvetica','bold'); doc.text(title, pageW/2, 18, {align:'center'})`
     - Info box bottom-left: family name + export date, small font
     - `doc.save('vanshavali.pdf')`
- Export dialog `<dialog>`: format radio (PNG default / PDF), language radio (EN default / HI), Confirm button → `doExport({format, lang})`

**Verification:**
- [ ] PNG export: downloads `vanshavali.png`; full tree visible; Hindi text readable (not boxes)
- [ ] PDF export: downloads `vanshavali.pdf`; A3 landscape; title block top-centre; info box bottom-left; full tree not clipped
- [ ] Export at EN: only English names; export at HI: only Hindi names
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] Both formats export correctly with Devanagari rendering in both language modes

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary

**Completion Record:**
- Implementation notes: `export.js` — `_getFontB64()` fetches woff2 once and caches as base64; injected into SVG clone via `<defs><style>`. `_buildSvgClone(lang)` deep-clones `#tree-svg`, removes empty-hint, rebuilds each node's name text from `data-name-en`/`data-name-hi` attributes, removes `.name-secondary` for a single-lang export view. `_svgToCanvas()` serializes to Blob URL, loads as `Image`, draws at 2× pixel ratio (raw canvas dimensions = logical × 2), then redraws after 250ms to allow custom font rendering. PNG export uses `canvas.toBlob` → anchor click. PDF export uses jsPDF 2.5.1 UMD (pinned for stable `window.jspdf.jsPDF` API), A3 landscape, title centred at top, tree image centred in body, info line bottom-left. jsPDF CDN script added to `index.html` before `export.js`. `npm test` 15/15 pass. Browser verification deferred (requires live DB).
- Deviations from plan: (1) Plan referenced removing `.name-hi`/`.name-en` class elements but renderer uses `name-primary`/`name-secondary` classes. Resolved by rebuilding names from `data-name-en`/`data-name-hi` attributes on `<g>` elements — achieves identical intent. (2) jsPDF pinned to `2.5.1` (not `@latest`) to avoid breaking API changes in v3.
- Field notes: Double-draw pattern (draw once on load, draw again after 250ms) is the reliable fix for SVG-with-embedded-font canvas rendering in browsers. Single draw may show boxes for Devanagari glyphs.

---

### Phase 15: Railway Deploy + Smoke Test

**Status:** Completed

**Target Files:**
- `railway.toml` — verify (created in Phase 1; no changes expected)

**Changes:**
- On Railway dashboard: create project; add PostgreSQL plugin; set env vars `ANTHROPIC_API_KEY`, `PORT=3000`
- Push repo to GitHub; connect Railway to repo
- Railway auto-detects Node.js via `package.json`; `startCommand` from `railway.toml` runs `npm run migrate && npm start`
- After deploy: SSH/exec into Railway container (or use Railway CLI) → `npm run seed:pdf` → `npm run seed`
- Verify live URL

**Verification:**
- [ ] Railway deploy succeeds (no build errors)
- [ ] `GET https://<railway-url>/health` returns `{"status":"ok"}`
- [ ] `GET https://<railway-url>/api/tree` returns seeded family data
- [ ] Visit app URL in browser: tree renders with grandfather's vanshavali data
- [ ] Add a test person via UI; verify it persists on page reload
- [ ] Export PNG and PDF from the live URL

**Definition of Done:**
- [ ] App live on Railway; seeded with grandfather's data; full round-trip (add → persist → export) verified

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary

**Completion Record:**
- Implementation notes: App live at https://katari-vanshavali-production.up.railway.app/. Fixed DATABASE_URL (was set to placeholder template string in Railway Variables tab — deleted manual override, Railway now injects real URL from linked Postgres service). Health check confirmed: GET /health → {"status":"ok"}.
- Deviations from plan: DATABASE_URL misconfiguration required triage before deploy succeeded.
- Field notes: Seeding and full round-trip UI verification deferred — UI pivot (phases 9A–18) needed first.

---

### Phase 16: README + Documentation

**Status:** Completed

**Target Files:**
- `README.md` — overwrite (currently a one-line stub)

**Changes:**
- Full project README covering:
  - Project description and purpose (Vanshavali — Indian genealogical tree builder)
  - Feature list (SVG tree, Hindi/English bilingual, transliteration chips, PNG/PDF export, pan/zoom)
  - Stack (Node.js + Express + PostgreSQL + vanilla JS)
  - Local development setup (prerequisites, clone, npm install, .env, migrate, seed, start)
  - Seeding from the grandfather's PDF (`npm run seed:pdf` + `npm run seed`)
  - Railway deployment guide (create project, add PostgreSQL, set env vars, deploy, seed, verify)
  - Usage guide (adding people, editing, exporting)

**Verification:**
- [x] `README.md` exists with all sections present
- [x] `npm test` still passes

**Definition of Done:**
- [x] README readable end-to-end by a new developer; Railway deployment steps complete and accurate

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary

**Completion Record:**
- Implementation notes: README.md rewritten from one-line stub. Covers: features, stack table, local dev setup (prerequisites → clone → install → .env → migrate → seed → start), PDF seeding workflow, Railway deployment guide (6 steps matching Phase 15 plan exactly), project structure tree, data model, usage quick-reference table. `npm test` 15/15 pass.
- Deviations from plan: None.
- Field notes: None.

---

### Phase 17: Auto-seed on First Boot

**Status:** Completed

**Completion Record:**
- Implementation notes: Committed in 9401862. Auto-seeds from docs/seed.json on first boot if DB is empty.
- Deviations from plan: None.
- Field notes: seed.json names corrected; gitignore updated.

---

### Phase 9A: Amend — Layout: Ancestor Split + Focal Root

**Status:** Pending
**Reason:** Current layout renders ancestor chain (Shankhi Singh → … → Bade Lal Singh) as a vertical left-column chain. Per annotated PDF, ancestors should be separated from the descendant tree.

**Target Files:**
- `public/js/tree-layout.js`

**Changes:**
- Export new function `splitTree(persons, relationships, focalNameEn)`:
  - Walk from root; find focal person by matching `name_en === focalNameEn` (case-insensitive fallback: first person with >1 child)
  - Collect `ancestorChain`: ordered list [oldest → focal's parent]
  - Collect `focalId` and all persons reachable below focal as `descendantPersons` + `descendantRelationships`
  - Return `{ ancestorChain, focalId, descendantPersons, descendantRelationships }`
- `computeLayout` unchanged — called only on descendant subset

**Verification:**
- [ ] `splitTree` returns non-empty ancestorChain for seeded data
- [ ] `descendantPersons` does not include ancestor-chain members
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] Correct split for seeded family data

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase 10A: Amend — Renderer: Ancestor Strip + Spouse + Lang-Only Nodes

**Status:** Pending
**Reason:** (1) Nodes show both EN+HI names; should show only current lang. (2) Spouse not rendered; should appear inline in node. (3) Ancestor chain should render as horizontal strip above main tree per annotated PDF.

**Target Files:**
- `public/js/tree-render.js`

**Changes:**
- **Node content** — replace primary+secondary+years with:
  - Line 1: name in current lang only, 13px bold
  - Line 2: `(spouse_en)` or `(spouse_hi)` per lang, 10px muted italic, only if spouse exists
  - Line 3: years, 9px muted, only if exists
  - Y positions computed dynamically based on which lines are present
- **`renderAncestorStrip(svg, ancestorChain, personMap, lang, offsetY)`**:
  - Horizontal row of compact boxes (120×40px) connected by `—` lines
  - Each box: name in current lang only, 11px
  - Fill: `#f5ede0` to distinguish from main tree nodes
  - Rendered at top of SVG above main tree
  - Returns strip height so main tree y-offset can be adjusted
- **`renderTree(state)`** updated:
  1. Call `splitTree(persons, relationships, 'Bade Lal Singh')`
  2. Call `renderAncestorStrip(...)` → get stripHeight
  3. Call `computeLayout(descendantPersons, descendantRelationships)` offset by stripHeight + gap
  4. Render descendant tree as before

**Verification:**
- [ ] Ancestor strip renders horizontally at top
- [ ] Main tree starts below strip
- [ ] Nodes show one language only (switches on lang toggle)
- [ ] Spouse shown in parens below name when present
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] All three changes visible and correct on live Railway URL

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase 11A: Amend — Pan/Zoom: Ctrl+Wheel Zoom, Plain Scroll = Pan

**Status:** Pending
**Reason:** Plain scroll wheel currently zooms, blocking natural pan. User expects scroll to pan, Ctrl+scroll to zoom.

**Target Files:**
- `public/js/canvas.js`

**Changes:**
- Wheel handler: add `if (!e.ctrlKey) return;` guard before zoom logic; remove `preventDefault()` for non-Ctrl wheel so browser handles native scroll
- After every `applyScale` call: set `window.__canvasScale = scale` (needed by Phase 18)

**Verification:**
- [ ] Plain scroll pans the viewport
- [ ] Ctrl+scroll zooms
- [ ] Zoom In/Out buttons still work
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] Scroll pans, Ctrl+scroll zooms on live URL

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase 12A: Amend — Context Menu: Remove Background Click

**Status:** Pending
**Reason:** Clicking blank canvas area opens "Add Person" sidebar unintentionally. Editing must be intentional via right-click context menu only.

**Target Files:**
- `public/js/context-menu.js`

**Changes:**
- Delete the SVG background `click` event listener block (the one calling `openNew(null)`)
- No other changes — right-click context menu remains the only add/edit/delete entry point

**Verification:**
- [ ] Clicking blank canvas does nothing
- [ ] Right-click on node still shows context menu
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] Background click is inert on live URL

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase 18: Initial View — Center on Bade Lal Singh

**Status:** Pending
**Reason:** On page load the view shows top-left (oldest ancestor). Bade Lal Singh should be the first visible focal point.

**Target Files:**
- `public/js/main.js`

**Changes:**
- Add `focusPerson(nameEn)` function:
  - `setTimeout(100)` to allow render to settle
  - Find `document.querySelector('.node[data-name-en="Bade Lal Singh"]')`
  - Read its `rect` x/y/width/height SVG attributes
  - Multiply by `window.__canvasScale || 1`
  - Set `viewport.scrollLeft` and `viewport.scrollTop` to center node in viewport
  - Fallback: if node not found, call `window.fitToViewport` equivalent (fit full tree)
- Call `focusPerson('Bade Lal Singh')` after `setState(...)` in `init()`

**Verification:**
- [ ] On page load, Bade Lal Singh node is visible and centered
- [ ] Fallback fires without error if name not matched
- [ ] `npm test` still passes

**Definition of Done:**
- [ ] Bade Lal Singh centered on load on live Railway URL

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

# Pivot Round 2 — Feedback 2026-06-01

**Trigger:** UI feedback on the deployed app (screenshots `21_51_45` EN, `21_53_37` HI).
**Nature:** Mostly defect amendments to completed UI work + 1 new module (minimap).
**Architect decisions (locked):** Compact top-down layout (tune current, no reorientation);
spouse rendered as **paired couple boxes** with marriage connector; include **minimap** and
**generation differentiation**; node **edit icon** + **add-child +** affordances on every card.
**Goal:** durable fixes ("once and for all") — prefer proven patterns/libraries over hand-rolled.

**Dependency order:** R0 -> R1 -> R2 -> R3 (layout chain first), then R4-R13 (independent polish).

---

### Phase R0: Amend — Schema + API: spouse birth/death/gender fields

**Status:** Pending
**Reason:** Paired couple boxes must show the spouse's own birth/death and color the spouse box by gender. Spouse is currently name-only (`spouse_en`/`spouse_hi`); no birth/gender data exists.

**Target Files:**
- `src/db/migrate.js`
- `src/routes/persons.js`
- `src/middleware/validate.js`
- `public/js/sidebar.js`
- `public/index.html`

**Changes:**
- `migrate.js`: `ALTER TABLE person ADD COLUMN IF NOT EXISTS spouse_birth_year INTEGER`, same for `spouse_death_year INTEGER`, `spouse_gender TEXT` (idempotent; safe on existing DB).
- `persons.js`: include the 3 new fields in INSERT and PATCH column lists.
- `validate.js`: year-range validation for spouse years; `spouse_gender` in {M,F,other,null}.
- `index.html`: add spouse birth/death number inputs + spouse gender radio under the spouse section.
- `sidebar.js`: `collectForm` / `populateForm` read & write the new fields.

**Verification:**
- [ ] `npm test` passes (API tests updated for new fields)
- [ ] Migrate runs idempotently against an already-seeded DB

**Definition of Done:**
- [ ] A spouse can have birth/death/gender persisted and round-tripped via the form

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R1: Amend — Node sizing: dynamic width + text wrapping

**Status:** Pending
**Reason:** Names truncate with ellipsis ("Dr. Harishankar Kumar...", "w. Major General Bimal..."). Fixed 170px node width cannot hold long names.

**Target Files:**
- `public/js/tree-layout.js`
- `public/js/tree-render.js`

**Changes:**
- Add a text-measurement helper (offscreen `<canvas>` `measureText`, or hidden SVG `<text>` `getComputedTextLength`) — pure utility, memoized by string+font.
- `tree-layout.js`: compute a **per-node width** = clamp(measured longest line + padding, MIN_W, MAX_W). Layout consumes per-node widths instead of the single `NODE_WIDTH` constant.
- `tree-render.js`: read each node's width from the layout result; **wrap** names longer than MAX_W onto 2 lines (word-break) instead of clipping; grow node height when wrapped. Remove/relax the `NAME_MAX`/`SPOUSE_MAX` ellipsis clamp.

**Verification:**
- [ ] No ellipsis on any seeded node at default zoom
- [ ] Long names wrap to 2 lines, box grows to fit
- [ ] `npm test` layout tests updated for variable widths

**Definition of Done:**
- [ ] All seeded names fully visible on the live tree

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R2: Amend — Paired couple boxes + marriage connector + colors

**Status:** Pending
**Reason:** Spouse currently shown as low-contrast red "w. ..." text inside the person box; "w." is wrong for husbands; representation is cramped. Architect chose paired couple boxes.

**Target Files:**
- `public/js/tree-layout.js`
- `public/js/tree-render.js`
- `public/css/main.css`

**Changes:**
- **Single vs couple is derived, not a separate mode:** a node renders as a couple unit **iff** `spouse_en` (or `spouse_hi`) is non-empty; otherwise a single box. Filling/clearing the spouse field is the only "setup" needed.
- A married person occupies a **couple unit**: person box + spouse box joined by a short horizontal **marriage connector** (`=` double line). Layout treats the couple unit's combined width as the node footprint; child edges descend from the **couple's center**.
- Each box shows: name (wrapped per R1) + that person's own `b./d.` line below the name (fixes "show birth below the name"). Spouse box uses `spouse_*` fields from R0.
- **No more "w./h." prefix** — each box is a labeled person; the relationship is implied by the connector. (Resolves the husband/wife mislabel entirely.)
- Color: spouse box filled by **spouse_gender** (fallback: opposite of person's gender); female fill `#8b1a1a` with light text, male/neutral cream with dark ink. Replaces the low-contrast `#cc2200`/`#e8a090` spouse text — improves contrast (WCAG AA target).
- Edges/strip updated to anchor on couple-center, not box-center.

**Verification:**
- [ ] Married nodes show two boxes + connector; birth under each name
- [ ] Husband spouses no longer labeled "w."
- [ ] Spouse box color has sufficient contrast (AA)
- [ ] `npm test` layout tests pass with couple widths

**Definition of Done:**
- [ ] Couples render side-by-side with correct colors and birth years on the live tree

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R3: Amend — Compact layout tuning (fit more per page)

**Status:** Pending
**Reason:** User repeatedly asks to "use a non-linear lineup to fit more on the same page." Decision: keep top-down but pack tighter (no reorientation).

**Target Files:**
- `public/js/tree-layout.js`

**Changes:**
- Tune `H_GAP`, `V_GAP`, `GROUP_GAP`, and `MAX_COLS` so leaf-heavy families wrap into denser blocks.
- Make childless leaf cards more compact (shorter height when single-line, no spouse).
- Re-balance group packing so wide branches don't dominate horizontal space.
- Keep changes data-driven via constants at top of file (no hardcoded magic mid-function).

**Verification:**
- [ ] Full seeded tree fits in materially less area than before at fit-to-screen
- [ ] No node overlaps (layout test assertion)
- [ ] `npm test` passes

**Definition of Done:**
- [ ] Noticeably more of the tree visible per screen at default zoom

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R4: Amend — Ancestor lineage connector polish

**Status:** Pending
**Reason:** The diagonal dashed line from the ancestor strip to Bade Lal Singh looks awkward.

**Target Files:**
- `public/js/tree-render.js`

**Changes:**
- Replace the single diagonal dashed `<line>` with an **orthogonal** connector (down -> across -> down) matching the tree's edge style, or a clean centered vertical drop with a subtle dotted segment only where it bridges the gap.
- Align the strip's exit point with the focal couple's true center (post-R2).

**Verification:**
- [ ] Connector is orthogonal/clean, visually consistent with tree edges
- [ ] Still clearly distinguishes "collapsed ancestors" from active tree

**Definition of Done:**
- [ ] Ancestor->focal link reads cleanly on the live tree

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R5: Amend — Generation differentiation (banding + patriarch)

**Status:** Pending
**Reason:** All nodes share identical visual weight; hard to read generations.

**Target Files:**
- `public/js/tree-render.js`
- `public/css/main.css`

**Changes:**
- Add subtle horizontal **generation banding** (alternating very-faint parchment tint per depth row) behind nodes, inside the decorative border.
- Give the **patriarch / focal node** (Bade Lal Singh) a slightly thicker border to distinguish root from leaves.
- Keep it subtle — must not fight the vintage aesthetic (conventions.md).

**Verification:**
- [ ] Generations visually distinguishable; aesthetic preserved
- [ ] Banding spans correctly under wrapped/compact rows

**Definition of Done:**
- [ ] Generation cues visible and tasteful on the live tree

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R6: Amend — Title i18n (EN/HI header switch)

**Status:** Pending
**Reason:** In English mode the header still shows "वंशावली" (Hindi). Title is hardcoded and not language-aware.

**Target Files:**
- `public/index.html`
- `public/js/main.js`
- `src/routes/tree.js`

**Changes:**
- Render the header title from `state.tree.title_en` / `title_hi` based on `state.lang`; re-render on lang toggle.
- Inline edit writes to the field matching the current language (PATCH `title_en` or `title_hi`).
- Ensure `tree.js` PATCH accepts `title_hi` as well as `title_en`.
- Sensible fallback when a language's title is empty (show the other, or a default).

**Verification:**
- [ ] EN mode shows English title; HI mode shows Hindi title
- [ ] Editing in each mode persists to the right column
- [ ] `npm test` passes

**Definition of Done:**
- [ ] Header language matches canvas language on the live app

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R7: Amend — Node affordances: hover + (add child) & edit icon

**Status:** Pending
**Reason:** Add-child and edit are invisible (right-click only). User wants a "+" under each node and an edit icon on each card.

**Target Files:**
- `public/js/tree-render.js`
- `public/css/main.css`
- `public/js/sidebar.js` (reuse `openNew`/`openEdit`)

**Changes:**
- Render a small **edit (pencil) icon** in each node's corner and a **"+" add-child button** below each node, shown on hover/focus (always visible on touch/no-hover).
- Wire "+" -> `openNew(personId)`; pencil -> `openEdit(personId)`. Stop propagation so they don't conflict with the node's existing click-to-edit.
- Keep targets large enough to click; ensure they scale with zoom.

**Verification:**
- [ ] Hovering a node reveals "+" and edit icon
- [ ] "+" opens Add-Child form with parent preset; pencil opens Edit
- [ ] Icons don't appear in exported image (stripped in export clone)

**Definition of Done:**
- [ ] Add-child and edit are discoverable directly on each card

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R8: Amend — Add form: parent dropdown

**Status:** Pending
**Reason:** "Add Mode should let you select a dropdown parent." Currently Add (toolbar) only makes a root; child requires right-click on a specific node.

**Target Files:**
- `public/index.html`
- `public/js/sidebar.js`

**Changes:**
- Add a **Parent** `<select>` to the Add form, populated from `state.persons` (name_en, "— none (root) —" option). Hidden/locked in Edit mode and when opened via a node's "+" (pre-selected, but still editable).
- On submit (new), use the selected parent for the relationship instead of relying solely on `sidebarParentId`.

**Verification:**
- [ ] Toolbar "Add" lets you pick any existing parent or "none"
- [ ] Selecting a parent creates the relationship; "none" creates a root
- [ ] `npm test` passes

**Definition of Done:**
- [ ] A child can be added to any chosen parent from the Add form

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R9: Amend — Export robust rewrite (canvg, self-hosted jsPDF)

**Status:** Pending
**Reason:** "Export still doesn't work." Root causes: (1) `@font-face` fonts do not load when an SVG is rendered via `<img>` (current path) — fragile double-draw hack; (2) jsPDF is loaded from the `unpkg` CDN and silently fails (`window.jspdf` undefined) if the CDN is blocked.

**Target Files:**
- `public/js/export.js`
- `public/index.html`
- `public/vendor/` (new — self-hosted libs)

**Changes:**
- **Self-host** `jsPDF` (and, if adopted, `canvg`) under `public/vendor/` instead of CDN — removes the network dependency that breaks export.
- Replace the SVG->`<img>`->canvas path with **`canvg`** (parses SVG and rasterizes via Canvas2D using the page's already-loaded Devanagari font) — the proven fix for embedded-font export. Keep a base64-font-in-`<defs>` fallback.
- Use `await document.fonts.ready` before rasterizing.
- Add a one-time diagnostic during execution (console: which step fails) to confirm the real failure before/after the fix.
- Guard large-canvas dimension limits (cap dpr if width*dpr would exceed browser canvas max).

**Verification:**
- [ ] PNG export downloads and shows Devanagari + Latin correctly
- [ ] PDF export (A3 landscape) downloads with the full tree
- [ ] Works with network throttled / CDN blocked (self-hosted libs)
- [ ] Hover "+"/edit affordances absent from the exported image

**Definition of Done:**
- [ ] Export reliably produces correct PNG and PDF on the live app

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies _(canvg is a justified, scoped addition — replaces fragile hand-rolled code)_
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R10: Amend — Export dialog → popover anchored to button

**Status:** Pending
**Reason:** Export `<dialog>` opens centered/left, away from the Export button.

**Target Files:**
- `public/index.html`
- `public/css/main.css`
- `public/js/main.js`

**Changes:**
- Convert the centered `<dialog showModal()>` to a small **popover anchored under the Export button** (CSS positioned relative to the toolbar-right, or the Popover API / non-modal `dialog.show()` with positioning).
- Click-outside / Esc closes it.

**Verification:**
- [ ] Export options appear directly beneath the Export button
- [ ] Closes on outside-click and Esc; export still fires correctly

**Definition of Done:**
- [ ] Export popover is anchored to its button on the live app

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R11: Amend — Visible-interaction help hint

**Status:** Pending
**Reason:** Right-click CRUD and other mouse controls are invisible. Add a discoverable hint.

**Target Files:**
- `public/index.html`
- `public/css/main.css`
- `public/js/main.js`

**Changes:**
- Add a small **"?" / help button** in the toolbar that opens a brief tooltip/card listing controls: scroll = pan, Ctrl+scroll = zoom, click card = edit, "+" = add child, right-click = menu.
- Optional: first-load one-time inline hint near the tree, dismissible.

**Verification:**
- [ ] Help affordance is visible and explains the core interactions
- [ ] Does not obstruct the canvas; dismissible

**Definition of Done:**
- [ ] Mouse controls are discoverable without reading the README

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R12: New — Minimap (toggleable)

**Status:** Pending
**Reason:** Large trees are easy to get lost in when zoomed. Add a toggleable corner minimap.

**Target Files:**
- `public/js/minimap.js` (new)
- `public/index.html`
- `public/css/main.css`

**Changes:**
- New `minimap.js`: render a scaled-down overview of the tree SVG in a bottom corner with a **viewport rectangle** reflecting current scroll/zoom; clicking/dragging the rect pans the main viewport.
- Toggle button in toolbar to show/hide; hidden by default on small trees.
- Subscribe to scroll/zoom (reuse `canvas.js` scale state) to keep the rect in sync.

**Verification:**
- [ ] Minimap shows full tree + a viewport box that tracks scroll/zoom
- [ ] Clicking/dragging the box pans the main canvas
- [ ] Toggle hides/shows it; excluded from export

**Definition of Done:**
- [ ] Minimap aids navigation on the live large tree

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

---

### Phase R13: Amend — README refresh + layout tests

**Status:** Pending
**Reason:** README is stale (describes invisible interactions, pre-pivot behavior); layout tests must cover dynamic width + couple layout.

**Target Files:**
- `README.md`
- `tests/tree-layout.test.js`

**Changes:**
- Update README: current interaction model (card edit icon, "+", parent dropdown, help button, minimap), export behavior, screenshots note.
- Add/extend layout tests: dynamic node widths, couple-unit footprint, no-overlap with wrapped nodes, compact packing.

**Verification:**
- [ ] README matches actual app behavior
- [ ] `npm test` passes with new assertions

**Definition of Done:**
- [ ] Docs accurate; layout regressions covered by tests

**Self-Audit Checklist:**
- [ ] Only target files touched
- [ ] No public-facing changes without approval
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries
- [ ] Error handling present where needed
- [ ] No unjustified new dependencies
- [ ] All tests pass
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_


---

# Pivot Round 3 — Feedback 2026-06-02

**Trigger:** Live feedback on deployed R2 (screenshots `00_14_*`, `3.png`, exports `4`,`5`,`6.pdf`,`7.pdf`).
**Locked decisions:** colours = role fill + gender accent (bloodline cream, married-in spouse
blue-grey, ♂/♀ accent, dark text); Devanagari font = **Tiro Devanagari Hindi** (self-hosted);
child packing = **2-row grid** per family.

**Diagnosed export bugs (from PDFs):**
- Tree is **clipped** in export — `canvg` `scaleWidth/scaleHeight` conflict with SVG width/height+viewBox.
- PDF **title is garbage** (`5 6 > 5 2 @`) — jsPDF Helvetica can't render Devanagari `title_en`
  (which also confirms `title_en` holds Devanagari → "English title broken").

**Order:** T1–T2 visual base → T3–T4 form → T5–T6 layout → T7 export → T8–T10 polish → T11 docs/tests.

| ID | Phase | Target files |
|----|-------|--------------|
| T1 | Colour system: role fill (cream bloodline / blue-grey spouse) + ♂/♀ gender accent, dark text, drop solid red | `tree-render.js`, `node-metrics.js`, `main.css` |
| T2 | Self-host **Tiro Devanagari Hindi**; use regular weight for names (fixes "lost in bold") | `public/fonts/`, `main.css`, `tree-render.js`, `node-metrics.js`, `export.js` |
| T3 | **Married checkbox** reveals/hides spouse fields; couple still derived from spouse name | `index.html`, `sidebar.js` |
| T4 | Edit-mode **parent dropdown shows current parent**; allow **re-parenting** (swap relationship) | `sidebar.js`, `index.html` |
| T5 | Child lines originate from **centre of the = connector** (couple), box centre (single) | `tree-render.js` |
| T6 | **2-row grid** child packing (cols = ceil(n/2)); small families stay one row | `tree-layout.js` |
| T7 | **Export fix**: remove canvg scale opts + `ctx.scale(dpr)` (no clipping); **bake title into image** (canvg renders Devanagari); PDF uses JPEG + ASCII footer only | `export.js`, `index.html` |
| T8 | **Softer generation banding** (low-alpha rgba watermark, not hard stripes) | `tree-render.js`, `main.css` |
| T9 | **Minimap contrast** — stronger border + drop shadow | `main.css` |
| T10 | **Title robustness** — language-appropriate placeholder; editing in EN writes `title_en`; document how to set the English title | `main.js`, `index.html` |
| T11 | README + layout tests (2-row packing, connector origin) | `README.md`, `tests/tree-layout.test.js` |
| T12 | **Density pass (my judgment, "fit more / less scrolling")**: compact leaf cards (shorter when single-line/no spouse), smaller min-width + tighter gaps, fit-to-screen on load, marriage gap trimmed | `node-metrics.js`, `tree-layout.js`, `main.js` |

**Notes / decisions baked in:**
- "Spouse and children different colours" → handled by **role fill** (children are bloodline = cream;
  spouses = blue-grey). Gender remains visible via the ♂/♀ accent.
- Married checkbox is **form UX only**; the renderer still treats a node as a couple iff a spouse
  name exists (keeps data model simple, no new column).
- Re-parenting validates against selecting self (and direct descendants) to avoid cycles.
- Node heights are already uniform (clean bands); T8 only softens the band fill.


**Status:** Round 3 (T1–T12) implemented 2026-06-02; `npm test` 22/22. Committed locally, pending push/deploy. The migration from R0 still self-applies on deploy.

---

# Pivot Round 4 — Feedback 2026-06-02

**Trigger:** Live feedback — (1) move the **Living** checkbox above Birth year;
(2) add a **Sequence** number so siblings sort by birth year with a manual fallback.
**Locked decisions (architect-approved):**
- Sort rule: **sequence ascending, then birth_year ascending**; unnumbered siblings
  sort after numbered ones; equal/absent keys keep stable DB order.
- Form reorder applies to the **person section only** (spouse block unchanged).
- `sequence` is a **person** attribute (spouses are part of the couple box, not ordered).
- No drag/drop reordering UI — the number field is the only ordering control.

**Order:** R4-1 (schema/API) -> R4-2 (form HTML) -> R4-3 (sidebar JS) -> R4-4 (layout + tests).
Local verification = `npm test` only (no local Postgres; migration self-applies on deploy).

### Phase R4-1: Schema + API — sequence column

**Status:** Completed

**Target Files:**
- `src/db/migrate.js` — modify
- `src/routes/persons.js` — modify
- `src/middleware/validate.js` — modify

**Changes:**
- migrate.js: idempotent `ALTER TABLE person ADD COLUMN IF NOT EXISTS sequence INTEGER`
  (place with the other additive R2 ALTERs).
- validate.js: add `requireValidSequence(field)` — when present and not null, must be an
  integer >= 1 (else 400 `sequence must be an integer >= 1`). Export it.
- persons.js: add `sequence` to the POST INSERT column list + `$N` value (`sequence || null`);
  add `sequence` to the PATCH `allowed` array; wire `requireValidSequence('sequence')` into
  both POST and PATCH middleware chains.

**Verification:**
- [x] `npm test` green (api suite unaffected; INSERT/PATCH still succeed) — 26/26
- [x] Manual read of migrate.js confirms ALTER is idempotent + additive

**Definition of Done:**
- [x] `sequence` accepted on create + patch; invalid (0, negative, non-int) rejected 400
- [x] Column add is idempotent and runs inside existing migration flow

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries (sequence validator)
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary
- [x] Does not break other completed phases

**Completion Record:**
- `sequence INTEGER` added in migrate.js beside the R2 ALTERs (idempotent `IF NOT EXISTS`).
- `requireValidSequence` rejects non-integer / `< 1`; allows null/undefined/empty (optional).
- persons.js: POST INSERT now 15 cols (`sequence || null`); PATCH allow-list includes `sequence`; validator wired into both chains.
- `npm test` → 26/26 pass. No DB-dependent step run locally (no Postgres); migration self-applies on Railway deploy.
- No deviations from plan.

### Phase R4-2: Form — reorder Living + add Sequence

**Status:** Completed

**Target Files:**
- `public/index.html` — modify

**Changes:**
- Move the person `Living` checkbox `form-group` (currently below the Birth/Death row)
  to sit immediately **above** that row. Spouse `Living` untouched.
- Add a `Sequence` number input below the Birth/Death row:
  `<input type="number" id="f-seq" name="sequence" min="1" />` with label + hint
  "order among siblings (1, 2, 3…)".

**Verification:**
- [x] `npm test` green (render-smoke unaffected) — 32/32
- [x] Manual: form order is Name(HI) -> Living -> Birth/Death -> Sequence -> Gender

**Definition of Done:**
- [x] Living checkbox renders above Birth year (person only)
- [x] Sequence input present with correct id/min/hint

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary
- [x] Does not break other completed phases

**Completion Record:**
- Person `Living` group moved above the Birth/Death row; spouse block untouched.
- Added `#f-seq` number input (`min="1"`) below Birth/Death with sibling-order hint.
- Approved public-facing change (form layout) — matches Pivot R4 requirements.

### Phase R4-3: Sidebar — read/write sequence

**Status:** Completed

**Target Files:**
- `public/js/sidebar.js` — modify

**Changes:**
- `getSidebarEls`: add `seq: document.getElementById('f-seq')`.
- `collectForm`: `sequence: els.seq && els.seq.value ? parseInt(els.seq.value, 10) : null`.
- `populateForm`: `if (els.seq) els.seq.value = person.sequence != null ? person.sequence : ''`.
- `resetForm` already clears via `form.reset()` — no change.

**Verification:**
- [x] `npm test` green — 32/32
- [x] Manual: editing a person round-trips the sequence value (collect/populate symmetric)

**Definition of Done:**
- [x] Sequence persists on create/edit and repopulates on edit

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary
- [x] Does not break other completed phases

**Completion Record:**
- `getSidebarEls` exposes `seq` (#f-seq); `collectForm` emits `sequence` (int or null);
  `populateForm` repopulates it. `resetForm` clears via `form.reset()` (no change needed).
- No deviations from plan.

### Phase R4-4: Sibling ordering + tests

**Status:** Completed

**Target Files:**
- `public/js/tree-layout.js` — modify
- `tests/tree-layout.test.js` — modify

**Changes:**
- `buildAdjacency(persons, relationships)`: build a `personById` map; after populating
  each `childrenOf[parent]` array, sort it with `compareSiblings(personById[a], personById[b])`.
- Add pure `compareSiblings(a, b)`: `effSeq = seq ?? Infinity`, `effBirth = birth_year ?? Infinity`;
  return `effSeq` diff, else `effBirth` diff, else `0` (stable).
- Tests: all-numbered orders by sequence; mixed numbered/unnumbered puts numbered first;
  equal/absent sequence falls back to birth_year ascending.

**Verification:**
- [x] `npm test` green incl. new sibling-order cases — 32/32 (was 26; +6)
- [x] Existing layout/overlap tests still pass

**Definition of Done:**
- [x] Siblings ordered sequence-then-birthyear across all layout paths
- [x] Stable for equal/absent keys (no reshuffle of existing data)

**Self-Audit Checklist:**
- [x] Only target files touched
- [x] No public-facing changes without approval
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries
- [x] Error handling present where needed
- [x] No unjustified new dependencies
- [x] All tests pass
- [x] Changes are minimum necessary
- [x] Does not break other completed phases

**Completion Record:**
- `compareSiblings` (exported) sorts by `sequence ?? ∞` then `birth_year ?? ∞`, else 0;
  `buildAdjacency` sorts every child array via a `personById` map — single lever for all
  three layout paths. `tree-render.js` childrenOf intentionally left unsorted (no position impact).
- 6 new tests: comparator (3) + render-order (3: all-numbered, numbered-before-unnumbered, birth-year tie).
- No deviations from plan.

---

# Execution Plan: Phase 2 — Admin & Moderation

## Objective
Add admin auth (first-run signup + accounts) and an edit-moderation pipeline
(queue + version history) without changing the public tree's presentation.

## Current Baseline
Phase 1 complete; 32/32 tests pass. API is fully open (no auth). Mutations go
directly from client (`sidebar.js`, `context-menu.js`, `main.js`) → `api.js` →
`src/routes/{persons,relationships,tree}.js` → Postgres. `server.js` auto-seeds
from `docs/seed.json` when DB empty. Tests: jest + supertest, `pool.query` mocked.

## Rules
- One phase active at a time. Wait for architect approval before each.
- Maintain style per `.state/conventions.md` (kebab files, camelCase, immutable
  client state, files <400 lines, validate inputs, raw-object API responses).
- No public-facing visual changes to the tree. Moderation default OFF →
  behaviour stays identical until an admin enables it.
- 3-Strike Rule: 3 consecutive test/build failures → STOP, document, wait.
- Commit only when architect asks. Stage with explicit file paths.
- Before a phase, assess session fit; recommend splitting if too large.
- All migrations additive + idempotent. No secrets in source (env only).

## Standard Self-Audit (applies to every phase)
- [ ] Only the phase's target files touched
- [ ] No public-facing tree visual changes without approval
- [ ] Matches conventions.md
- [ ] No hardcoded secrets/tokens (env only)
- [ ] No sensitive data in logs/errors (no password hashes, no tokens)
- [ ] External input validated at boundaries
- [ ] Error handling present; errors return raw `{error}` objects
- [ ] No unjustified new dependencies
- [ ] Tests pass (backend phases) / `node --check` + render-smoke clean (frontend)
- [ ] Changes are the minimum necessary

## Phase Summary
| Phase | Name | Status |
|-------|------|--------|
| 2.0 | Test harness extension + deps | Pending |
| 2.1 | Schema migration (admin_user, change_request, moderation flag) | Pending |
| 2.2 | Auth credentials + middleware | Pending |
| 2.3 | Auth routes + server wiring | Pending |
| 2.4 | Settings route (moderation toggle) | Pending |
| 2.5 | Mutation apply service + changelog | Pending |
| 2.6 | Changes routes (submit/list/applied/mine/approve/reject/revert) | Pending |
| 2.7 | Moderation branch in persons/relationships/tree routes | Pending |
| 2.8 | Cleanup — remove seed | Pending |
| 2.8a | Local in-memory DB (pg-mem) adapter + `dev:mock` | Pending |
| 2.9 | Client API wrappers + moderation state load | Pending |
| 2.10 | mutate.js chokepoint + refactor call-sites | Pending |
| 2.11 | overlay.js optimistic cache + toast + reconcile | Pending |
| 2.12 | Public history panel | Completed |
| 2.13 | Admin page (signup/login/dashboard/queue/history/revert) | Completed |
| 2.14 | Visibility schema — show_birth_year + two death-hide flags | Pending |
| 2.15 | Serializer + pickPublicFields whitelist + requireBoolean (+ unit tests) | Pending |
| 2.16 | Wire serializer/whitelist into tree GET + persons routes (+ tests) | Pending |
| 2.17 | settings show_birth_year + changes whitelist + applyChange merge (+ test) | Pending |
| 2.18 | Two-tier edit form (#admin-fields removal + hide-death checkboxes) | Pending |
| 2.19 | Admin "Show birth year" dashboard toggle | Pending |
| 2.20 | Local round-trip test on mock DB (manual E2E) | Pending |

> **Phases 2.8a + 2.20 (added 2026-06-07b):** Local mock-DB testing track. **2.8a**
> adds an in-memory Postgres (`pg-mem`) behind `USE_MOCK_DB` + a `dev:mock` launcher,
> sequenced after the backend phases (2.1–2.8) and before the client/admin UI phases
> (2.9+) so admin features and UI are locally click-testable as they land. **2.20**
> is the end-of-cycle full manual round-trip on the mock DB. Controlling input: the
> "[AMENDED 2026-06-07b]" sections of `architecture_decisions.md` and `requirements.md`.

> **Phases 2.14–2.19 (added 2026-06-07):** Admin-Curated Public View & Simplified
> Public Form. Depend on auth (`req.admin`, 2.2–2.3), settings (2.4), changes/apply
> (2.5–2.6), moderation-state load (2.9), and the admin dashboard (2.13) — hence
> sequenced last. Controlling inputs: the 2026-06-07 sections of `requirements.md`
> and `architecture_decisions.md`.

## Phase Details

### Phase 2.0: Test harness extension + deps

**Status:** Completed

**Target Files:**
- `package.json` — modify (add deps)
- `tests/helpers/db-mock.js` — create

**Changes:**
- Add deps `bcryptjs`, `jsonwebtoken`, `cookie-parser` (`npm install`).
- Create `tests/helpers/db-mock.js`: export factory returning a mock `pool` with
  `query` (jest.fn) and `connect` (jest.fn → `{ query: jest.fn(), release: jest.fn() }`)
  so transactional `applyChange` can be tested.

**Verification:**
- [x] `npm install` succeeds; deps appear in `package.json`.
- [x] `npm test` → still 32/32 (helper not yet imported anywhere).

**Definition of Done:**
- [x] Deps installed; transaction mock helper available for later phases.

**Self-Audit:** standard + confirm no production code imports the test helper.
- [x] Only target files touched (`package.json`, `package-lock.json`, `tests/helpers/db-mock.js`)
- [x] No public-facing tree visual changes
- [x] Matches conventions.md (kebab file, camelCase factories)
- [x] No hardcoded secrets/tokens
- [x] No sensitive data in logs/errors
- [x] External input validated at boundaries (n/a — test helper)
- [x] Error handling present (n/a — test helper)
- [x] New deps justified (auth deps required by Phase 2.2–2.3 plan)
- [x] Tests pass — 32/32
- [x] Changes minimum necessary
- [x] No production code imports the test helper (grep-confirmed: only available to tests)

**Completion Record:**
- Implementation notes: Installed `bcryptjs@^3.0.3`, `jsonwebtoken@^9.0.3`,
  `cookie-parser@^1.4.7` (17 transitive packages). Created
  `tests/helpers/db-mock.js` exporting `createDbMock()` (pool with `query` jest.fn
  + `connect` resolving to a `{ query, release }` client mock; client also exposed
  via `pool.__client` for transactional assertions) and `createClientMock()`.
  Shape matches `src/db/client` (pg.Pool). Not in jest's `*.test.js` testMatch, so
  it is not run as a suite. `npm test` → 32/32.
- Deviations from plan: None.
- Field notes: `bcryptjs` (pure-JS, no native build) chosen over `bcrypt` —
  correct for Railway/Windows-dev parity. 1 moderate npm-audit advisory in a
  transitive dep (no criticals; same posture as Phase 0).

---

### Phase 2.1: Schema migration

**Status:** Completed

**Target Files:**
- `src/db/migrate.js` — modify

**Changes:**
- Add idempotent: `ALTER TABLE tree ADD COLUMN IF NOT EXISTS moderation_enabled BOOLEAN NOT NULL DEFAULT FALSE`.
- `CREATE TABLE IF NOT EXISTS admin_user (...)` per architecture schema.
- `CREATE TABLE IF NOT EXISTS change_request (...)` + the two indexes, per schema.
- Place beside existing ALTERs; keep the migration log line.

**Verification:**
- [x] `node --check src/db/migrate.js` passes. → `CHECK_OK`
- [x] `node -e "require('./src/db/migrate')"` loads without error. → `REQUIRE_OK`
- [x] SQL reviewed: every statement is `IF NOT EXISTS`; safe to re-run.
- [ ] (Manual, on deploy) migrate runs clean against the live DB. — deferred to
      deploy / Phase 2.8a mock-DB boot.

**Definition of Done:**
- [x] New tables/column defined idempotently; existing 32 tests unaffected (32/32).

**Self-Audit:** standard + idempotency confirmed.
- [x] Only target file touched (`src/db/migrate.js`)
- [x] No public-facing tree visual changes
- [x] Matches conventions.md
- [x] No hardcoded secrets/tokens (env only)
- [x] No sensitive data in logs/errors
- [x] External input validated at boundaries (n/a — DDL)
- [x] Error handling present (existing `require.main` catch covers standalone run)
- [x] No unjustified new dependencies
- [x] Tests pass — 32/32
- [x] Changes minimum necessary
- [x] Idempotency confirmed — every statement `IF NOT EXISTS`, safe to re-run

**Completion Record:**
- Implementation notes: Added a "Phase 2" block in `runMigrations()` after the
  `relationship` table and before the completion log: `ALTER TABLE tree ADD COLUMN
  IF NOT EXISTS moderation_enabled BOOLEAN NOT NULL DEFAULT FALSE`, then
  `CREATE TABLE IF NOT EXISTS admin_user`, `CREATE TABLE IF NOT EXISTS
  change_request`, and the two `CREATE INDEX IF NOT EXISTS` statements. DDL copied
  verbatim from architecture "Schema Additions". Placed after `tree`/`admin_user`
  exist so `change_request`'s FKs (`tree(id)`, `admin_user(id)`) resolve.
- Deviations from plan: None.
- Field notes: Live-DB run still deferred, but Phase 2.8a (pg-mem boot) will now
  exercise this migration in-memory locally — earlier real-execution signal than
  waiting for Railway.

---

### Phase 2.2: Auth credentials + middleware

**Status:** Completed

**Target Files:**
- `src/auth/credentials.js` — create
- `src/middleware/auth.js` — create
- `tests/auth.test.js` — create (unit portion)

**Changes:**
- `credentials.js`: `hashPassword`, `verifyPassword` (bcryptjs); `signToken(payload)`,
  `verifyToken(token)` (jsonwebtoken). Secret from `process.env.JWT_SECRET`; if
  unset, generate a random secret once at module load + `console.warn`. 7-day expiry.
- `auth.js`: `attachAdmin` (read `req.cookies.token` → verify → `req.admin = {id,username}`
  or null; never throw); `requireAdmin` (→ 401 `{error}` when `!req.admin`).
- Tests: hash/verify round-trip; token sign/verify; verifyToken rejects garbage;
  requireAdmin 401 path with a stub req/res.

**Verification:**
- [x] `npm test` includes new auth unit tests, all green; 32 prior still pass. → 40/40.
- [x] `node --check` on both source files → `CHECK_OK`.

**Definition of Done:**
- [x] Password hashing + JWT cookie verification available and tested.

**Self-Audit:** standard + no secret logged; hashes never returned.
- [x] Only target files touched
- [x] No public-facing tree visual changes
- [x] Matches conventions.md (CommonJS, camelCase, small files)
- [x] No hardcoded secrets/tokens — `JWT_SECRET` from env; random per-boot fallback
- [x] No sensitive data in logs/errors — warn never prints the secret; no hash logging
- [x] External input validated (verifyToken/verifyPassword guard empty/garbage)
- [x] Error handling present — verifyToken never throws (try/catch → null)
- [x] No unjustified new deps (bcryptjs/jsonwebtoken added in 2.0)
- [x] Tests pass — 40/40
- [x] Changes minimum necessary

**Completion Record:**
- Implementation notes: `credentials.js` — bcryptjs `SALT_ROUNDS=10`; JWT 7-day
  expiry; secret from `JWT_SECRET` else `crypto.randomBytes(32)` per-boot with a
  one-line warn (value never logged). `verifyPassword` returns false on empty
  inputs; `verifyToken` returns null on any failure (never throws) so middleware
  is safe. `auth.js` — `attachAdmin` sets `req.admin={id,username}` from a valid
  cookie else null, guarding missing `req.cookies`; `requireAdmin` → 401 raw
  `{error}`. 8 new tests cover hash/verify, token round-trip, garbage rejection,
  and both middleware paths. `JWT_SECRET` pinned in the test for determinism.
- Deviations from plan: None.
- Field notes: Token payload carries `{id, username}`; `attachAdmin` keys off
  `payload.id` — auth routes (2.3) must sign with that shape.

---

### Phase 2.3: Auth routes + server wiring

**Status:** Completed

**Target Files:**
- `src/routes/auth.js` — create
- `server.js` — modify
- `tests/auth.test.js` — extend (route portion)

**Changes:**
- `auth.js` router: `GET /status` (`{needsSetup: admin count==0, authed: !!req.admin}`),
  `POST /setup` (create first admin ONLY if table empty, else 409; set cookie),
  `POST /login` (verify creds → set httpOnly SameSite=Lax cookie; 401 generic on fail),
  `POST /logout` (clear cookie), `GET /me` (`{username}` or 401),
  `POST /admins` (`requireAdmin`; create another admin; 409 on dup username).
  Validate username/password presence + min length.
- `server.js`: `app.use(cookieParser())`, `app.use(attachAdmin)` before routers;
  mount `/api/auth`.

**Verification:**
- [x] Tests: setup creates first admin; second setup → 409; login ok/fail; me
      with/without cookie; admins requires auth. All green + 32 prior pass. → 53/53.
- [x] `node --check` on `auth.js` + `server.js` → `CHECK_OK`.

**Definition of Done:**
- [x] Full auth lifecycle works; admin can be created via signup then add more.

**Self-Audit:** standard + setup is hard-guarded to empty table; cookie httpOnly.
- [x] Only target files touched
- [x] No public-facing tree visual changes
- [x] Matches conventions.md
- [x] No hardcoded secrets/tokens
- [x] No sensitive data in logs/errors (login failure is generic; no hash echoed)
- [x] External input validated (username ≥3, password ≥8; presence on login)
- [x] Error handling — try/catch → 500 raw `{error}` on every async route
- [x] No unjustified new deps (cookie-parser added 2.0)
- [x] Tests pass — 53/53
- [x] Changes minimum necessary

**Completion Record:**
- Implementation notes: `auth.js` — cookie name `token`, httpOnly + SameSite=Lax,
  `secure` in production, 7-day maxAge; token signed `{id, username}` (matches
  2.2 `attachAdmin`). `/setup` hard-guarded by `adminCount()===0` → 409 otherwise.
  `/login` returns generic 401 on unknown user or bad password (no enumeration).
  `/admins` gated by `requireAdmin`, 409 on duplicate. `server.js` mounts
  `cookieParser()` then `attachAdmin` before all routers, and `/api/auth` first.
  13 supertest route tests added (status/setup/login/logout/me/admins incl. 401/409
  paths) using the `{query: jest.fn()}` pool mock + signed cookies.
- Deviations from plan: None.
- Field notes: `res.clearCookie` must NOT receive `maxAge` (Express deprecation) —
  split into `COOKIE_BASE` (clear) vs `COOKIE_OPTS` (set). api.test.js now triggers
  the benign "JWT_SECRET not set" warn because it boots the server without setting
  it — expected degraded-mode behavior, not a failure.

---

### Phase 2.4: Settings route (moderation toggle)

**Status:** Completed

**Target Files:**
- `src/routes/settings.js` — create
- `server.js` — modify (mount)
- `tests/changes.test.js` — create (settings portion)

**Changes:**
- `GET /api/settings` (public) → `{ moderation_enabled }` from the single tree row.
- `PATCH /api/settings` (`requireAdmin`) → set `moderation_enabled` (boolean validate).
- Mount in `server.js`.

**Verification:**
- [x] Tests: GET returns flag; PATCH without auth → 401; PATCH with admin → toggles.
      Also: GET default false (no row), PATCH 400 non-boolean, PATCH 404 no row. → 59/59.
- [x] `node --check` on `settings.js` + `server.js` → `CHECK_OK`.

**Definition of Done:**
- [x] Moderation flag readable publicly, toggle gated to admin.

**Self-Audit:** standard.
- [x] Only target files touched
- [x] No public-facing tree visual changes
- [x] Matches conventions.md
- [x] No hardcoded secrets/tokens
- [x] No sensitive data in logs/errors
- [x] External input validated (`typeof === 'boolean'` guard)
- [x] Error handling — try/catch → 500; 404 when no tree row
- [x] No unjustified new deps
- [x] Tests pass — 59/59
- [x] Changes minimum necessary

**Completion Record:**
- Implementation notes: `settings.js` — `GET /` public, defaults `moderation_enabled`
  to `false` when no tree row exists; `PATCH /` gated by `requireAdmin`, strict
  `typeof === 'boolean'` validation (rejects `'yes'`/strings with 400), 404 when no
  tree row. Mounted at `/api/settings` after `/api/auth`. 6 tests added to
  `tests/changes.test.js` (new suite) covering public read, default, 401/400/404,
  and admin toggle.
- Deviations from plan: None.
- Field notes: `show_birth_year` will join this route's `GET`/`PATCH` payload in
  Phase 2.17 — keep the boolean-validation pattern consistent there.

---

### Phase 2.5: Mutation apply service + changelog

**Status:** Completed

**Target Files:**
- `src/services/mutations.js` — create
- `src/services/changelog.js` — create
- `tests/changes.test.js` — extend (service portion)

**Changes:**
- `mutations.applyChange(client, {op_type, entity, target_id, payload})` — performs
  the live write for person/relationship/tree; for `create person` with
  `payload.parent_id`, also inserts the relationship. Returns `{before, after}`.
  Runs against a passed pg client (caller owns the transaction).
- `mutations.withTransaction(fn)` — `pool.connect` → BEGIN/COMMIT/ROLLBACK wrapper.
- `changelog.recordApplied`, `recordPending`, `summarize(before,after)`.
- Tests use the Phase 2.0 connect mock: create/update/delete apply paths; revert
  uses before_snapshot; missing target → throws (→ 409 later).

**Verification:**
- [x] Tests for each op path green; transaction rollback on error covered. → 71/71.
- [x] `node --check` on both service files → `CHECK_OK`.

**Definition of Done:**
- [x] Single transactional writer + changelog helpers, reused by routes + approve/revert.

**Self-Audit:** standard + input validated before write; no partial writes (tx).
- [x] Only target files touched
- [x] No public-facing tree visual changes
- [x] Matches conventions.md (small focused services)
- [x] No hardcoded secrets/tokens
- [x] No sensitive data in logs/errors
- [x] External input validated (missing target → NOT_FOUND; name_en required)
- [x] Error handling — withTransaction ROLLBACK on any error; never partial
- [x] No unjustified new deps
- [x] Tests pass — 71/71
- [x] Changes minimum necessary

**Completion Record:**
- Implementation notes: `mutations.js` — `applyChange(client, change)` dispatches
  person/relationship/tree × create/update/delete, returning `{before, after}`
  snapshots. Person create optionally bundles a relationship (`parent_id`); accepts
  explicit `id`/`relationship_id`/`x_pos`/`y_pos` so revert-of-delete can restore
  faithfully. Update fetches `before` first and throws `NOT_FOUND` (→ 409 later) on
  missing target. Delete captures person + its relationships before cascade.
  `withTransaction(fn)` does connect→BEGIN→fn→COMMIT, ROLLBACK+rethrow on error,
  release in finally. `changelog.js` — `recordPending`/`recordApplied` insert
  change_request rows; JSONB fields `JSON.stringify`'d via `toJson` (node-pg would
  otherwise mis-serialize objects/arrays). `summarize` gives a compact
  create/delete/update diff for history. Tests use `createClientMock` for
  applyChange and the `createDbMock` connect path for withTransaction.
- Deviations from plan: None. (Plan's `applyChange(client, …)` client-owns-tx
  signature kept exactly; `recordApplied` also accepts an explicit `status` for the
  revert audit row in 2.6.)
- Field notes: `before/after` shapes differ by entity (person create →
  `{person, relationship}`; person delete before → `{person, relationships[]}`;
  relationship → `{relationship}`; tree/person update → full rows). Phase 2.6 revert
  must branch on entity/op to invert. JSONB params must be stringified — reuse
  `toJson` if more change_request writers appear.

---

### Phase 2.6: Changes routes

**Status:** Completed

**Target Files:**
- `src/routes/changes.js` — create
- `server.js` — modify (mount)
- `tests/changes.test.js` — extend (routes portion)

**Changes:**
- `POST /api/changes` (public): validate payload via existing validators per
  entity/op; `recordPending` with `client_token`; return `{id, status:'pending'}`.
- `GET /api/changes?status=pending` (`requireAdmin`): queue newest-first.
- `GET /api/changes/applied` (public): applied+reverted rows, **anonymized**
  (omit `resolved_by`/username), with before→after summary.
- `GET /api/changes/mine?token=` (public): rows for that client_token + statuses.
- `POST /:id/approve` (`requireAdmin`): optional edited payload; `withTransaction`
  → `applyChange` → mark applied + before/after + resolved_by/at. 409 if target gone.
- `POST /:id/reject` (`requireAdmin`): status=rejected + resolved_by/at.
- `POST /:id/revert` (`requireAdmin`): restore before_snapshot via applyChange;
  mark original `reverted`; append a new applied audit row describing the revert.

**Verification:**
- [x] Tests: submit→pending; approve applies+records; reject; revert restores;
      `/applied` has no admin identity; `/mine` filters by token; admin guards 401. → 81/81.
- [x] `node --check` on `changes.js` + `server.js` → `CHECK_OK`.

**Definition of Done:**
- [x] Queue + history + approve/reject/revert endpoints complete and tested.

**Self-Audit:** standard + public log anonymized; admin endpoints guarded.
- [x] Only target files touched
- [x] No public-facing tree visual changes
- [x] Matches conventions.md
- [x] No hardcoded secrets/tokens
- [x] No sensitive data in logs/errors — `/applied` omits `resolved_by`/identity
- [x] External input validated (`validateChange` on submit; `requireUUID` on :id)
- [x] Error handling — approve/revert run in `withTransaction`; NOT_FOUND→409; 500 fallback
- [x] No unjustified new deps
- [x] Tests pass — 81/81
- [x] Changes minimum necessary

**Completion Record:**
- Implementation notes: `changes.js` — public `POST /` validates via `validateChange`
  (op/entity enums, UUID target for update/delete, name_en for person-create, year
  ranges, rel parent/child UUIDs) then `recordPending` → `{id, status:'pending'}`
  (201). Admin `GET /?status=` queue newest-first. Public `GET /applied` maps rows
  through `summarize`, omitting `resolved_by`/identity (anonymized). Public
  `GET /mine?token=` filters by `client_token`. `POST /:id/approve` (admin):
  reads the row, 409 if not pending, applies the (optionally edited) payload inside
  `withTransaction`, marks the row applied with before/after snapshots + resolver.
  `POST /:id/reject` flips pending→rejected (409 otherwise). `POST /:id/revert`
  (admin): 409 unless applied; `revertChange` inverts the op via `applyChange`
  (create→delete, delete→re-create person + its relationships, update→restore
  before), marks original `reverted`, and appends a new applied audit row with
  swapped snapshots and `INVERSE_OP` op_type (stays within the op_type CHECK).
  Mounted at `/api/changes`. 10 route tests added (incl. tx-path approve/revert via
  the connect mock).
- Deviations from plan: Revert audit row uses the **inverse op_type**
  (create→delete etc.) rather than a literal `'revert'`, because the
  `change_request.op_type` CHECK only allows create/update/delete. Same intent,
  schema-safe.
- Field notes: Route registration order — literal GETs (`/applied`, `/mine`) coexist
  with `/` and the `POST /:id/*` actions without collision (no `GET /:id` exists).
  Tests must use real-UUID `:id` values (requireUUID) — `c1`-style ids 400.

---

### Phase 2.7: Moderation branch in mutation routes

**Status:** Completed

**Target Files:**
- `src/routes/persons.js` — modify
- `src/routes/relationships.js` — modify
- `src/routes/tree.js` — modify
- `tests/api.test.js` / `tests/changes.test.js` — extend

**Changes:**
- In each mutating handler, after validation: if `moderation_enabled` AND
  `!req.admin` → create a pending `change_request` (via changelog) and return
  `202 {status:'pending', id}` instead of writing. Else → `applyChange` +
  `recordApplied` and return the entity as today.
- Keep existing response shapes for the applied path (tests depend on them).
- Read moderation flag once per request (single tree row).

**Verification:**
- [x] Existing person/relationship/tree tests still pass (moderation OFF path). → 83/83.
- [x] New tests: moderation ON + no admin → 202 pending, no DB mutation
      (`pool.connect` not called); moderation ON + admin → applies.
- [x] `node --check` on all three routes → `CHECK_OK`.

**Definition of Done:**
- [x] Direct routes correctly fork queue vs apply; every applied change logged.

**Self-Audit:** standard + applied path response unchanged (no client breakage).
- [x] Only target files touched (persons/relationships/tree routes + api.test.js)
- [x] No public-facing tree visual changes
- [x] Matches conventions.md
- [x] No hardcoded secrets/tokens
- [x] No sensitive data in logs/errors
- [x] External input validated (existing validators retained ahead of the fork)
- [x] Error handling — apply path in withTransaction; NOT_FOUND→404, 23505→409, 500 fallback
- [x] No unjustified new deps
- [x] Tests pass — 83/83
- [x] Changes minimum necessary

**Completion Record:**
- Implementation notes: Each mutating handler now reads moderation once
  (`moderationOn()` — a 4-line local helper in each route file) and forks:
  moderation ON && `!req.admin` → `recordPending` → `202 {status:'pending', id}`,
  no live write (verified `pool.connect` uncalled). Otherwise the write runs through
  `withTransaction(applyChange + recordApplied)`, preserving the exact prior response
  shapes — POST person → 201 `result.after.person`; PATCH person → `result.after`;
  DELETE → `{deleted:id}`; POST rel → 201 `result.after.relationship`; PATCH tree →
  `{tree: result.after}`. Error mapping preserved: missing person/rel/tree →
  NOT_FOUND→404, duplicate rel → 23505→409, no-tree-on-create → 400. Every applied
  mutation now also writes an `applied` change_request (history). `api.test.js`
  rewritten onto the `createDbMock` connect-capable mock with sequenced
  `__client.query`, plus 2 new moderation-fork tests.
- Deviations from plan: `moderationOn()` duplicated across the three route files
  (4 lines each) rather than a shared module — staying within the phase's target
  file list (a shared helper would be a new file = out of scope). Acceptable, minimal.
- Field notes: Admins bypass the queue even when moderation is ON (write-through +
  logged), matching the architecture. The applied path always emits a history row,
  so 2.12's public History panel has data regardless of moderation state.

---

### Phase 2.8: Cleanup — remove seed

**Status:** Completed

**Target Files:**
- `server.js` — modify (remove `seedIfEmpty`, `runSeed` import/call)
- `src/db/seed.js` — delete
- `scripts/seed-pdf.js` — delete
- `package.json` — modify (remove `seed`, `seed:pdf` scripts)
- (keep `docs/seed.json`)

**Changes:**
- Remove the seed import, `SEED_PATH`, `seedIfEmpty`, and its call in `start()`.
- Delete the two seed source files; drop the two npm scripts.

**Verification:**
- [x] `node --check server.js` passes; `node -e "require('./server')"` loads. → `REQUIRE_OK`.
- [x] `npm test` → all green (api.test imports server). → 83/83.
- [x] grep: no remaining references to `seed.js`/`runSeed`/`seedIfEmpty`. → none found.

**Definition of Done:**
- [x] Seed runtime + scripts gone; `docs/seed.json` retained; app boots.

**Self-Audit:** standard + no dangling requires.
- [x] Only target files touched (server.js, package.json, deleted seed files)
- [x] No public-facing tree visual changes
- [x] Matches conventions.md
- [x] No hardcoded secrets/tokens
- [x] No sensitive data in logs/errors
- [x] External input validated (n/a — removal)
- [x] Error handling — `start()` still try/catch around `runMigrations` + listen
- [x] No unjustified new deps
- [x] Tests pass — 83/83
- [x] Changes minimum necessary
- [x] No dangling requires (also removed now-unused `fs` + `pool` imports)

**Completion Record:**
- Implementation notes: Removed `seedIfEmpty`, `SEED_PATH`, and the `await
  seedIfEmpty()` call from `server.js`; dropped the now-unused `fs`, `runSeed`, and
  `pool` imports (pool was only referenced by the seed check). `start()` now just
  `runMigrations()` → `listen`. Deleted `src/db/seed.js` and `scripts/seed-pdf.js`
  via `git rm`. Removed `seed` and `seed:pdf` npm scripts. `docs/seed.json` retained
  (gitignored; reused by the 2.8a dev launcher). grep confirms no remaining
  `runSeed`/`seedIfEmpty`/`seed.js`/`seed-pdf` references.
- Deviations from plan: Also removed `fs`/`pool` imports left unused by the seed
  removal — within `server.js` (a listed target) and necessary to avoid dead code.
- Field notes: `pdf-parse` remains a production dependency though its only consumer
  (`seed-pdf.js`) is gone — left in place intentionally; pruning deps is out of this
  phase's scope. Flag for a future cleanup if desired.

---

### Phase 2.8a: Local in-memory DB (pg-mem) adapter + `dev:mock`

**Status:** Completed
**Reason:** (Added 2026-06-07b) Enable click-testing admin features + UI locally
with no Postgres install. Sequenced after backend phases (2.1–2.8) and before the
client/admin UI phases (2.9+). Because 2.8 removed the production auto-seed, the
dev launcher must seed the in-memory DB itself.

**Target Files:**
- `package.json` — modify (add `pg-mem` devDependency + `dev:mock` script)
- `src/db/mock-pool.js` — create
- `src/db/client.js` — modify
- `scripts/dev-mock.js` — create

**Changes:**
- `package.json`: add `pg-mem` to devDependencies; script
  `"dev:mock": "node scripts/dev-mock.js"`.
- `src/db/mock-pool.js`: create a `pg-mem` DB instance; register any functions the
  schema needs that pg-mem lacks (at minimum `gen_random_uuid()` / pgcrypto; shim
  others as discovered). Export a factory returning a pg-compatible `Pool` via
  `db.adapters.createPg()`. The same backing instance must persist across all
  pool checkouts (single module-level instance).
- `src/db/client.js`: if `process.env.USE_MOCK_DB` is truthy, export the mock pool
  from `mock-pool.js`; otherwise export the real `pg.Pool` exactly as today
  (production path byte-for-byte unchanged when flag absent).
- `scripts/dev-mock.js`: set `process.env.USE_MOCK_DB='1'`; `runMigrations()`;
  then a small self-contained `seedFromJson()` that reads `docs/seed.json` and
  inserts tree+persons+relationships via the pool (independent of the deleted
  production seeder); then `require('../server')` to start the app. Log a clear
  "MOCK DB — in-memory, data resets on restart" banner.

**Verification:**
- [x] `node --check src/db/mock-pool.js src/db/client.js scripts/dev-mock.js` passes. → `CHECK_OK`.
- [x] `npm install` adds `pg-mem` (devDep only). → `pg-mem@^3.0.14` in devDependencies.
- [x] `npm test` → still all green (`USE_MOCK_DB` unset under jest). → 83/83.
- [x] `npm run dev:mock` boots: migrations run, seed loads, server listens; **no**
      `DATABASE_URL` / Postgres required. → health ok; seeded 44 persons / 43 rels.
- [x] Manual: `GET /api/tree` returns seeded data from the in-memory DB;
      `GET /api/auth/status` → `{needsSetup:true}`.

**Definition of Done:**
- [x] App runs fully locally on the in-memory DB via `npm run dev:mock`; production
      DB path untouched; tests green.

**Self-Audit Checklist:**
- [x] Only target files touched (package.json, mock-pool.js, client.js, dev-mock.js)
- [x] No public-facing tree visual changes
- [x] Matches conventions.md conventions
- [x] No hardcoded secrets or tokens
- [x] No sensitive data in logs or errors
- [x] External input validated at boundaries (n/a — dev tooling)
- [x] Error handling present (dev-mock top-level catch → exit 1)
- [x] New dep (`pg-mem`) is devDependency only; not in production path
- [x] `node --check` clean + `npm test` green
- [x] Changes are minimum necessary
- [x] Amendment doesn't break other completed phases (real client path unchanged)

**Completion Record:**
- Implementation notes: `mock-pool.js` builds a single cached `pg-mem` instance and
  returns its `createPg()` Pool. pg-mem implements few natives, so registered:
  `gen_random_uuid` (**`impure:true`** — critical; without it pg-mem reuses one UUID
  and every insert collides on the PK), `btrim` (title-normalisation migration), and
  a no-op `pgcrypto` extension so `CREATE EXTENSION IF NOT EXISTS pgcrypto` succeeds.
  `client.js` branches on `USE_MOCK_DB` (mock pool) vs the unchanged real `pg.Pool`.
  `scripts/dev-mock.js` sets the flag first, runs the real migration, then a
  self-contained `seedFromJson()` (maps seed short-ids → UUIDs; independent of the
  deleted production seeder), then `app.listen` (server.js left untouched —
  `require.main` guard means requiring it doesn't auto-start). Verified live: the
  whole app runs on pg-mem with no Postgres.
- Deviations from plan: dev-mock listens itself rather than relying on server's
  `start()` — keeps `server.js` out of this phase's target list. Same outcome.
- Field notes: **The `impure:true` flag is the key pg-mem gotcha** — found via a live
  boot smoke test (duplicate-PK on the 2nd seeded person). Always smoke-boot, not
  just `node --check`. `docs/seed.json` is stale (title "Genealogy" vs live "Katari
  Lineage"); refreshing it from a real Railway dump is pending (see resume.md / 2.20).

---

### Phase 2.9: Client API wrappers + moderation state load

**Status:** Completed

**Target Files:**
- `public/js/api.js` — modify
- `public/js/main.js` — modify

**Changes:**
- `api.js`: add `getSettings`, auth (`authStatus`, `login`, `logout`, `me`),
  changes (`submitChange`, `myChanges`, `appliedChanges`). Add
  `credentials:'same-origin'` to `apiFetch`.
- `main.js init`: load `GET /api/settings` + `GET /api/auth/me` → set
  `window.__moderation = { enabled, admin }` (default `{enabled:false, admin:false}`
  on failure). No behaviour change yet (chokepoint added next phase).

**Verification:**
- [x] `node --check` on both files; render-smoke still passes. → `CHECK_OK`, 83/83.
- [~] Manual: `window.__moderation` populated in console — deferred to 2.20 (browser);
      server side confirmed live (`/api/settings`, `/api/auth/me`).

**Definition of Done:**
- [x] Client knows moderation + admin state; new API wrappers available.

**Self-Audit:** standard + failure of new fetches degrades to OFF, never blocks load.
- [x] Only target files touched (api.js, main.js)
- [x] No public-facing tree visual changes (no behaviour change this phase)
- [x] Matches conventions.md
- [x] No hardcoded secrets/tokens
- [x] No sensitive data in logs/errors
- [x] External input validated (n/a — read wrappers)
- [x] Error handling — both state loads wrapped; degrade to OFF/not-admin
- [x] No unjustified new deps
- [x] node --check + render-smoke green
- [x] Changes minimum necessary

**Completion Record:**
- Implementation notes: `api.js` — added `credentials:'same-origin'` to `apiFetch`
  (sends the admin cookie) and wrappers `getSettings`, `authStatus`, `login`,
  `logout`, `me`, `submitChange`, `myChanges`, `appliedChanges`. `main.js` —
  `loadModerationState()` runs first in `init()`, setting
  `window.__moderation = {enabled, admin}` from `/api/settings` + `/api/auth/me`;
  both calls are independently try/caught so failure degrades to OFF/not-admin and
  never blocks the tree load. A default `window.__moderation` is also set at module
  load. No behaviour change yet — the chokepoint that reads this lands in 2.10.
- Deviations from plan: None.
- Field notes: `me()` throwing 401 is the not-admin signal (expected, not an error) —
  swallowed silently; only settings failure warns.

---

### Phase 2.10: mutate.js chokepoint + refactor call-sites

**Status:** Completed

**Target Files:**
- `public/js/mutate.js` — create
- `public/js/sidebar.js` — modify
- `public/js/context-menu.js` — modify
- `public/js/main.js` — modify (title)
- `public/index.html` — modify (include mutate.js before sidebar/context-menu/main)

**Changes:**
- `mutate.js` intent fns returning the new `{persons, relationships}` (or pending
  marker): `createPersonWithParent(data, parentId)`, `updatePerson(id, data, reparent)`,
  `deletePerson(id)`, `updateTitle(field, value)`. Each: if
  `window.__moderation.enabled && !admin` → `api.submitChange(...)` (one bundled
  request) → return pending marker; else existing direct `api.*` calls.
- Refactor `sidebar.handleSubmit`/`handleDelete`, `context-menu.ctxDeletePerson`,
  `main.editTitle`/`wireTitleEdit` to delegate to `mutate.*`.

**Verification:**
- [x] `node --check` all; render-smoke passes. → `CHECK_OK`, 83/83.
- [~] Manual (moderation OFF): add/edit/delete/re-parent/title behave exactly as
      today — deferred to 2.20 (browser). OFF path calls the same `api.*`/state
      logic as before, just relocated into `mutate.*`.

**Definition of Done:**
- [x] Single mutation chokepoint; OFF path identical to current behaviour.

**Self-Audit:** standard + OFF path is behaviour-preserving; immutable state updates kept.
- [x] Only target files touched (mutate.js, sidebar.js, context-menu.js, main.js, index.html)
- [x] No public-facing tree visual changes (OFF path behaviour-preserving)
- [x] Matches conventions.md (immutable state arrays kept)
- [x] No hardcoded secrets/tokens
- [x] No sensitive data in logs/errors
- [x] External input validated (unchanged — server validators + existing form checks)
- [x] Error handling — call sites keep their try/catch + error surfaces
- [x] No unjustified new deps
- [x] node --check + render-smoke green
- [x] Changes minimum necessary

**Completion Record:**
- Implementation notes: `mutate.js` exposes `window.mutate` with
  `createPersonWithParent(data, parentId)`, `updatePerson(id, data, reparent)`,
  `deletePerson(id)`, `updateTitle(field, value)`. `_isQueued()` =
  `__moderation.enabled && !admin`. Direct path runs the original `api.*` calls and
  returns the recomputed `{persons, relationships}` (or `{tree}`); queued path posts
  one bundled `api.submitChange(...)` and returns `{pending:true, id, change}`.
  Refactored `sidebar.handleSubmit` (new + edit/re-parent via a `reparent` arg),
  `sidebar.handleDelete`, `context-menu.ctxDeletePerson`, and both title editors in
  `main.js` to delegate and only `setState` when `!result.pending`. `mutate.js`
  added to `index.html` before sidebar/context-menu/main.
- Deviations from plan: None. (Queued path returns a marker only; optimistic
  overlay + toast arrive in 2.11 as planned — `_token()` already reads
  `window.overlay.token()` when present.)
- Field notes: Re-parent is intentionally a **direct-path-only** concern here; under
  moderation the queued person-update submits field changes (relationship re-parenting
  via the queue is out of scope for this cycle).

---

### Phase 2.11: overlay.js optimistic cache + toast + reconcile

**Status:** Completed

**Target Files:**
- `public/js/overlay.js` — create
- `public/js/main.js` — modify (apply overlay in load/setState; call reconcile)
- `public/index.html` — modify (include overlay.js)

**Changes:**
- `overlay.js`: generate/persist `client_token`; store/list/remove pending overlay
  entries in localStorage; `applyOverlay(state)` merges pending edits over server
  data with a "pending" marker; `reconcile()` calls `api.myChanges(token)` →
  applied→remove, rejected→remove + notice, pending→keep; `toast(msg)` helper.
- `mutate.js` (created prior) writes overlay entries + shows "Submitted to admin
  for approval" toast on the pending path.
- `main.init`: after loading tree, `applyOverlay` + `reconcile`.

**Verification:**
- [x] `node --check`; render-smoke passes. → `CHECK_OK`, 83/83.
- [x] Smoke (dev:mock): `/js/overlay.js` + `/js/mutate.js` serve 200; index
      references overlay.js; `/api/tree` returns 49 persons.
- [~] Manual (moderation ON, anonymous) toast/pending/reconcile flow — deferred to
      2.20 (browser).

**Definition of Done:**
- [x] Contributors keep seeing their own pending edits; self-heals on resolve.

**Self-Audit:** standard + overlay never sent to other visitors; localStorage only.
- [x] Only target files touched (overlay.js, main.js, index.html) + mutate.js*
- [x] No public-facing tree visual changes (overlay only affects the local viewer)
- [x] Matches conventions.md (immutable merge; small module)
- [x] No hardcoded secrets/tokens
- [x] No sensitive data in logs/errors
- [x] External input validated (reconcile tolerates failure; JSON.parse guarded)
- [x] Error handling — reconcile try/catch → warn; never blocks load
- [x] No unjustified new deps
- [x] node --check + render-smoke green
- [x] Changes minimum necessary

**Completion Record:**
- Implementation notes: `overlay.js` exposes `window.overlay` —
  `token()` (persistent per-browser `client_token` in localStorage),
  `add/list/remove/clear`, `applyOverlay(base)` (immutably merges pending
  create/update/delete-person and tree-update entries over the server base;
  pending creates get a temp id, pending deletes are filtered out, updates tagged
  `__pending`), `reconcile()` (via `api.myChanges(token)` → applied/reverted drop,
  rejected drop + notice, pending keep), and an inline-styled `toast()` (no CSS
  coupling, app palette). `main.js` keeps a `serverBase` snapshot and
  `refreshWithOverlay()` (= setState(applyOverlay(base))); `init` sets the base,
  renders merged, then reconciles and re-renders if changed. `mutate.js` pending
  path routed through a new `_queue()` helper that submits, records the overlay
  entry, toasts "Submitted to admin for approval", and calls
  `window.refreshWithOverlay()`. `overlay.js` included before `mutate.js` in
  index.html.
- Deviations from plan: *`mutate.js` was edited (not in the 2.11 target-file list,
  but the phase's Changes section explicitly assigns it the overlay-write + toast
  responsibility). Flagging for transparency — same intent, scoped to the pending
  path only.
- Field notes: Pending nodes carry `__pending` in state but the renderer doesn't
  style them yet (would require a `tree-render.js` hook, out of scope) — the toast is
  the primary feedback; visible per-node pending styling is a candidate follow-up.
  Reconcile is reload-driven (per architecture), not real-time.

---

### Phase 2.12: Public history panel

**Status:** Completed

**Target Files:**
- `public/js/history.js` — create
- `public/index.html` — modify (panel markup + include + unobtrusive trigger)
- `public/css/main.css` — modify (panel styling; added per user feedback 2026-06-07)

**Changes:**
- `history.js`: fetch `api.appliedChanges()`; render a read-only, anonymized
  list (what/when/before→after) in a toggleable panel. No revert controls.
- `index.html`: minimal trigger (e.g. a small "History" control in existing
  toolbar area) + panel container; no change to tree rendering.

**Verification:**
- [x] `node --check` → `CHECK_OK`; `npm test` → 83/83 pass (render-smoke clean).
- [x] Smoke (dev:mock): `/js/history.js` serves 200; index references it;
      `id="btn-history"` present; `/api/changes/applied` returns 200.
- [~] Manual (browser) panel-content review (no admin names, no revert button) —
      deferred to 2.20, consistent with prior frontend phases.

**Definition of Done:**
- [x] Public version history visible and read-only.

**Self-Audit:** standard + no admin identity shown; tree visuals unchanged.
- [x] Only target files touched (history.js, index.html, main.css)
- [x] No public-facing tree visual changes (new hidden panel; tree render path untouched)
- [x] Matches conventions.md (kebab file, camelCase, small module, validate/escape output)
- [x] No hardcoded secrets/tokens
- [x] No sensitive data — server `/applied` omits `resolved_by`; panel shows no admin identity
- [x] External input escaped at the boundary (`_hEsc` on all names/values/labels)
- [x] Error handling — `api.appliedChanges()` wrapped in try/catch → friendly "Could not load history."
- [x] No unjustified new deps
- [x] node --check + 83/83 tests green
- [x] Changes minimum necessary

**Completion Record:**
- Implementation notes: `history.js` exposes `window.historyPanel`
  (`open/close/toggle`) — deliberately NOT `window.history` (browser built-in).
  Read-only: no revert controls (revert stays admin-only, Phase 2.13). Renders
  `api.appliedChanges()` entries via `_hDescribe` → `{action, detail}`: create/delete
  person show the person name (language-aware via `window.__state.lang`), update
  person/tree show a field-level `from → to` diff (`_hChangedHtml`), relationship
  changes show "Added/Removed a family link". Noise fields (`x_pos`, `y_pos`, ids,
  timestamps) filtered via `HISTORY_SKIP_FIELDS`. `reverted`-status entries get a
  badge + dimmed. All user text passes through `_hEsc`. Panel is a right-side drawer
  styled in `css/main.css` (`#history-panel`, using the existing palette variables),
  toggled via the codebase's `[hidden]` pattern (same as `#help-popover`/`#minimap`).
  Self-wires on DOMContentLoaded (canvas.js pattern): binds `#btn-history` toggle +
  Escape-to-close. `index.html` adds an icon-only `#btn-history` toolbar button
  (lucide `history`), an empty `#history-panel` container, and the `history.js`
  include after `mutate.js`.
- Deviations from plan: Panel styling lives in `css/main.css` (added to the target
  list) instead of injected from JS. It was initially injected from JS (no CSS file
  was a 2.12 target, mirroring 2.11's toast); moved to `main.css` per user feedback
  (2026-06-07) — the palette variables + `[hidden]` toggle pattern already there make
  it the cleaner home.
- Field notes: `window.history` is a browser built-in; any future client global for
  this feature must use `historyPanel` (or similar) to avoid clobbering the History API.

---

### Phase 2.13: Admin page

**Status:** Completed

**Target Files:**
- `public/admin.html` — create
- `public/css/admin.css` — create
- `public/js/admin/admin-api.js` — create
- `public/js/admin/admin-app.js` — create

**Changes:**
- `admin-api.js`: fetch wrappers (status/setup/login/logout/me/admins, settings
  get/patch, changes list/applied/approve/reject/revert), same-origin credentials.
- `admin-app.js`: view router — `status` → first-run **signup** / **login** /
  **dashboard**. Dashboard: moderation toggle; pending **queue** with
  approve / edit-then-approve / reject; **history** (full attribution) with
  one-click **revert**; **add-admin** form.
- `admin.html` + `admin.css`: standalone shell, vintage-consistent, isolated.

**Verification:**
- [x] `node --check` on both JS files → `CHECK_OK`; `npm test` → 83/83 pass.
- [x] E2E smoke (dev:mock): assets serve 200 (`/admin.html`, both `/js/admin/*`);
      `status` → `needsSetup:true`; `setup` issues cookie; `me` authed; moderation
      toggle ON; anonymous `POST /api/changes` → appears in `?status=pending`;
      **approve** → `applied`; **revert** → `reverted`; add second admin; logout.
- [~] Browser click-through (visual) — deferred to 2.20, consistent with prior UI
      phases. API workflow fully exercised above.

**Definition of Done:**
- [x] Full admin workflow operational end-to-end on the unlinked `/admin` page.

**Self-Audit:** standard + admin assets isolated from main app; guards enforced server-side.
- [x] Only target files touched (admin.html, admin.css, admin/admin-api.js, admin/admin-app.js)
- [x] No public-facing tree visual changes (standalone page; main app untouched)
- [x] Matches conventions.md (kebab files, camelCase, escaped output; admin-app.js 371 < 400)
- [x] No hardcoded secrets/tokens (credentials entered by the operator, sent to API)
- [x] No sensitive data in logs/errors (no password hashes/tokens surfaced)
- [x] External input — server validates; client guards `JSON.parse` (edit-approve) + `esc()` on all rendered text
- [x] Error handling — every API call in try/catch with user-facing messages; 401 → re-show login
- [x] No unjustified new deps
- [x] node --check + 83/83 tests green
- [x] Changes minimum necessary

**Completion Record:**
- Implementation notes: `admin-api.js` is a standalone same-origin fetch client
  (`adminFetch` mirrors `api.js`; throws with `err.status`). `admin-app.js` is a
  hash-free view router driven by `GET /api/auth/status`: `needsSetup` → signup,
  else `authed` → dashboard, else login (401 anywhere → falls back to login).
  Dashboard sections: **Moderation** (checkbox → `PATCH /api/settings`, optimistic
  with revert-on-error); **Add admin** (`POST /api/auth/admins`); **Pending queue**
  (`GET /api/changes?status=pending`) — each card shows the change description,
  submitter note, and the proposed `payload` in an editable JSON textarea, with
  **Approve** (uses stored payload), **Edit & approve** (parses textarea → `payload`
  override), **Reject**; **History** (`?status=applied` + `?status=reverted`, merged
  and sorted by `resolved_at` desc) with one-click **Revert** on applied rows.
  Change descriptions/diffs are computed client-side from `payload` (pending) and
  `before_snapshot`/`after_snapshot` (resolved), reusing the same field-label /
  skip-field approach as `history.js`. Queue click handling is delegated **once** on
  the stable `#queue-box` element (innerHTML is replaced per reload — re-attaching
  would stack listeners). `admin.css` is self-contained (the page does not load
  main.css) but uses the same vintage palette values.
- Deviations from plan: (1) The page is served at **`/admin.html`** via
  `express.static`, not a clean `/admin` route — adding the route would touch
  `server.js`, which is outside this phase's frontend-only target list. (2) Admin
  history attribution shows the **resolved timestamp** (and submitter note on
  pending) rather than the resolving admin's **username**: `change_request.resolved_by`
  is an admin UUID and there is no admin-lookup endpoint to map it to a name. Mapping
  it would require a new backend endpoint (out of scope here). Flagged for the
  architect — a future `GET /api/auth/admins` list could enable name attribution.
- Field notes: `GET /api/settings` (and the whole moderation/apply path) needs a
  `tree` row to exist; the row is auto-created lazily by `GET /api/tree`. On a fresh
  empty DB, hit the main app (or `/api/tree`) once before toggling moderation, or the
  PATCH returns 404 "No tree found" — expected, not a bug.

---

### Phase 2.14: Visibility schema — show_birth_year + two death-hide flags

**Status:** Pending

**Target Files:**
- `src/db/migrate.js` — modify

**Changes:**
- Add idempotent ALTERs beside the existing ones:
  - `ALTER TABLE tree ADD COLUMN IF NOT EXISTS show_birth_year BOOLEAN NOT NULL DEFAULT FALSE`
  - `ALTER TABLE person ADD COLUMN IF NOT EXISTS death_year_hidden BOOLEAN NOT NULL DEFAULT FALSE`
  - `ALTER TABLE person ADD COLUMN IF NOT EXISTS spouse_death_year_hidden BOOLEAN NOT NULL DEFAULT FALSE`
- Keep the migration log line.

**Verification:**
- [ ] `node --check src/db/migrate.js` passes.
- [ ] `node -e "require('./src/db/migrate')"` loads without error.
- [ ] SQL reviewed: every new statement is `ADD COLUMN IF NOT EXISTS`; safe to re-run.
- [ ] `npm test` → green (no behaviour change yet).

**Definition of Done:**
- [ ] Three columns defined idempotently, all defaulting to FALSE.

**Self-Audit:** standard + idempotency confirmed; defaults match requirements
(birth-year reveal OFF, force-hide OFF).

**Completion Record:** _(filled after verification)_

---

### Phase 2.15: Serializer + whitelist + requireBoolean (+ unit tests)

**Status:** Pending

**Target Files:**
- `src/serializers/person.js` — create
- `src/lib/public-fields.js` — create
- `src/middleware/validate.js` — modify
- `tests/serializer.test.js` — create

**Changes:**
- `person.js`: `serializePerson(row, { isAdmin, showBirthYear })` →
  - admin: return the row unchanged (incl. `death_year_hidden` /
    `spouse_death_year_hidden`).
  - public: shallow-copy, then `delete` `notes`, `death_year_hidden`,
    `spouse_death_year_hidden`; if `!showBirthYear` delete `birth_year` +
    `spouse_birth_year`; if `row.death_year_hidden` delete `death_year`; if
    `row.spouse_death_year_hidden` delete `spouse_death_year`.
  - `serializePersons(rows, opts)` maps the list. Pure, immutable (no row mutation).
- `public-fields.js`: `PUBLIC_FIELDS = ['name_en','name_hi','spouse_en','spouse_hi','spouse_gender','gender']`;
  `pickPublicFields(body)` returns a new object with only present whitelisted keys.
- `validate.js`: add `requireBoolean(field)` — optional; if present and not a real
  boolean → 400 `{error}`.

**Verification:**
- [ ] `node --check` on all three source files.
- [ ] `tests/serializer.test.js` covers: admin full passthrough incl. flags; public
      strips notes + flags always; `showBirthYear=false` strips both birth fields;
      `death_year_hidden` strips `death_year` (spouse symmetric); input row not mutated.
- [ ] `npm test` → all green (32 + new).

**Definition of Done:**
- [ ] Serializer, whitelist, and validator implemented and unit-tested; no route
      wired yet.

**Self-Audit:** standard + immutability (returns new objects); no field leak paths missed.

**Completion Record:** _(filled after verification)_

---

### Phase 2.16: Wire serializer/whitelist into tree GET + persons routes (+ tests)

**Status:** Pending

**Target Files:**
- `src/routes/tree.js` — modify
- `src/routes/persons.js` — modify
- `tests/persons.test.js` — modify

**Changes:**
- `tree.js` GET `/`: serialize persons via
  `serializePersons(rows, { isAdmin: !!req.admin, showBirthYear: tree.show_birth_year })`.
- `persons.js`:
  - POST/PATCH: when `!req.admin`, reduce `req.body` through `pickPublicFields`
    before building the insert/update (so non-admins can't write detail fields;
    PATCH leaves omitted columns untouched).
  - Allow admins to set `death_year_hidden` / `spouse_death_year_hidden`
    (add to the PATCH `allowed` list + POST insert; validate with `requireBoolean`).
  - Serialize every response with `{ isAdmin: !!req.admin, showBirthYear }` (read the
    current `tree.show_birth_year` once per request).
- Tests: non-admin POST/PATCH with detail fields → those columns unchanged; admin
  PATCH sets hide flags; GET responses reflect requester (admin vs public).

**Verification:**
- [ ] `node --check` on both routes.
- [ ] `npm test` → green incl. new persons assertions.
- [ ] Manual reasoning: a visitor `GET /api/tree` (default) returns no `birth_year`
      and no `notes`; admin returns full rows.

**Definition of Done:**
- [ ] Read + write person paths are auth-aware; non-admin writes whitelisted.

**Self-Audit:** standard + every person-emitting response passes through the
serializer; whitelist applied before DB write.

**Completion Record:** _(filled after verification)_

---

### Phase 2.17: settings show_birth_year + changes whitelist + applyChange merge (+ test)

**Status:** Pending

**Target Files:**
- `src/routes/settings.js` — modify
- `src/routes/changes.js` — modify
- `src/services/mutations.js` — modify
- `tests/settings.test.js` — modify

**Changes:**
- `settings.js`: `GET /` payload adds `show_birth_year`; `PATCH /` (admin) accepts
  `show_birth_year` (boolean, validated) alongside `moderation_enabled`.
- `changes.js`: on non-admin `POST /` submit, reduce the `payload` via
  `pickPublicFields` before queuing (defence in depth under moderation).
- `mutations.js`: confirm/ensure `applyChange` update is a **partial merge** (only
  keys present in payload are written) — never a full-row replace — so an approved
  public edit preserves admin-entered detail (death year, notes, hide flags).
- Tests: `GET /api/settings` includes `show_birth_year` default false; `PATCH`
  toggling it returns 401 without admin; (if feasible with the mock) approving a
  whitelisted change leaves untouched columns intact.

**Verification:**
- [ ] `node --check` on the three source files.
- [ ] `npm test` → green incl. settings assertions.

**Definition of Done:**
- [ ] Birth-year reveal toggle exposed + gated; queued payloads whitelisted; merge
      semantics guaranteed.

**Self-Audit:** standard + admin-only PATCH enforced server-side; no detail-field
loss on approve.

**Completion Record:** _(filled after verification)_

---

### Phase 2.18: Two-tier edit form (#admin-fields + hide-death checkboxes)

**Status:** Pending

**Target Files:**
- `public/index.html` — modify
- `public/js/sidebar.js` — modify

**Changes:**
- `index.html`: wrap the detail inputs (birth, death + Living, sequence, notes,
  spouse birth, spouse death + spouse Living) in a single `#admin-fields` container.
  Add two admin-only "Hide death year" checkboxes: `#f-hide-death` (person section)
  and `#f-spouse-hide-death` (spouse section).
- `sidebar.js`:
  - In `initSidebar`, if `!(window.__moderation && window.__moderation.admin)` →
    remove `#admin-fields` from the DOM (`.remove()`), so detail inputs are absent
    for non-admins (not merely hidden).
  - `getSidebarEls`, `populateForm`, `collectForm`, `setLiving`, `setSpouseLiving`:
    null-guard the now-optional elements; only include detail keys + the two hide
    flags in the payload when the admin elements exist.
  - Admin path: read/write `death_year_hidden` / `spouse_death_year_hidden` from the
    new checkboxes.

**Verification:**
- [ ] `node --check public/js/sidebar.js`.
- [ ] Manual (non-admin): open edit → only Name (EN/HI) + Gender + Married/Spouse
      name/gender present; no birth/death/notes inputs in the DOM; save works.
- [ ] Manual (admin): full form incl. the two hide-death checkboxes; toggling one
      hides that card's death year on the public view.
- [ ] Tree renders identically (no layout shift).

**Definition of Done:**
- [ ] Public form trimmed (DOM-level); admin form full with per-card death-hide.

**Self-Audit:** standard + no detail inputs in public DOM; null-guards prevent
errors when `#admin-fields` is absent; no render/layout change.

**Completion Record:** _(filled after verification)_

---

### Phase 2.19: Admin "Show birth year" dashboard toggle

**Status:** Pending

**Target Files:**
- `public/js/admin/admin-app.js` — modify
- `public/js/admin/admin-api.js` — modify

**Changes:**
- `admin-api.js`: ensure the settings PATCH wrapper can send `show_birth_year`
  (extend the existing settings call).
- `admin-app.js`: dashboard adds a "Show birth year (global)" toggle beside the
  moderation toggle; reads current value from `GET /api/settings`; on change →
  `PATCH /api/settings { show_birth_year }`; reflects success/failure.

**Verification:**
- [ ] `node --check` on both files.
- [ ] Manual: toggle ON → birth years appear across the public tree on reload;
      toggle OFF → they disappear; value persists (re-fetch reflects it).

**Definition of Done:**
- [ ] Admin can flip global birth-year visibility from the dashboard; no redeploy.

**Self-Audit:** standard + admin-only (route already `requireAdmin`); UI consistent
with the moderation toggle.

**Completion Record:** _(filled after verification)_

---

### Phase 2.20: Local round-trip test on mock DB (manual E2E)

**Status:** Pending
**Reason:** (Added 2026-06-07b) End-of-cycle full manual verification of the whole
Phase 2 feature set against the in-memory DB (`npm run dev:mock`) before pushing to
Railway. Catches integration issues that unit tests with a mocked pool cannot.

**Target Files:**
- `docs/local-testing.md` — create (the round-trip checklist, also future-reuse)

**Changes:**
- Write `docs/local-testing.md`: a step-by-step manual checklist run on
  `npm run dev:mock`. Then execute it and record results.

**Round-trip checklist (must all pass):**
- [ ] App boots on mock DB; seeded tree renders; existing Phase-1 UI intact
      (lock, search, collapse, minimap, export, lang toggle).
- [ ] First-run admin signup works; second signup blocked; login/logout via
      httpOnly cookie; `/admin` reachable, public tree needs no login.
- [ ] Moderation OFF (default): edits write through immediately (public + admin).
- [ ] Moderation ON: anonymous edit → 202 pending + "submitted for approval"
      toast + optimistic local overlay; admin sees it in the queue.
- [ ] Admin approve → change applied to tree; reject → discarded; both logged.
- [ ] Version history: applied changes listed (anonymized publicly); admin revert
      restores `before_snapshot`.
- [ ] Field visibility: birth years hidden by default; admin global reveal toggle
      flips them; seeded death years visible; admin per-card death force-hide
      removes one card's death year publicly while admin still sees it; notes
      admin-only.
- [ ] Simplified public form: non-admin sees only name/gender/spouse; admin sees
      full form; submitting public form cannot smuggle detail fields.
- [ ] Tree layout/palette/export visually unchanged throughout.

**Verification:**
- [ ] Every checklist item above ticked, or failures logged as new defects/pivot.

**Definition of Done:**
- [ ] Full admin + visibility round-trip verified locally on the mock DB; results
      recorded; remaining risk for Railway is config/seed only.

**Self-Audit Checklist:**
- [ ] Only target file touched (`docs/local-testing.md`)
- [ ] No public-facing tree visual changes
- [ ] Matches conventions.md conventions
- [ ] No hardcoded secrets or tokens
- [ ] No sensitive data in logs or errors
- [ ] External input validated at boundaries (n/a — doc/manual)
- [ ] Error handling present where needed (n/a)
- [ ] No unjustified new dependencies
- [ ] Findings recorded honestly (failures → defects/pivot, not glossed)
- [ ] Changes are minimum necessary
- [ ] Amendment doesn't break other completed phases

**Completion Record:**
_(Filled after verification)_

