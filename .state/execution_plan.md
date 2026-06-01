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
| 15 | Railway Deploy + Smoke Test | Pending |

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

**Status:** Active

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
- Implementation notes:
- Deviations from plan:
- Field notes:
