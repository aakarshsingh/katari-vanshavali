# Architecture: Vanshavali Builder

## Overview

Express (Node.js) on Railway serves a static vanilla-JS single-page app and a
JSON REST API backed by PostgreSQL. The family tree is rendered as an inline SVG
inside a scrollable viewport div — SVG handles Devanagari text natively, scales
losslessly, and can be serialized for export without html2canvas font-loading
issues. All tree mutations flow through the REST API. Claude Haiku handles
transliteration on demand (server-side, debounced). Export serializes the SVG to
a canvas bitmap with the Noto Sans Devanagari font embedded as base64, then
produces a PNG download or jsPDF A3 PDF. Seed data is a one-time developer
operation (Step 0): `scripts/seed-pdf.js` calls Claude Vision on the existing
`docs/vanshavali.pdf`, writes `docs/seed.json`, and `npm run seed` loads it into
the DB before first deploy.

## Module Breakdown

| Module/Component | Responsibility | New or Modified |
|-----------------|----------------|-----------------|
| `server.js` | Express entry: mounts API routes, serves `/public` as static | New |
| `src/db/client.js` | `pg` connection pool (idleTimeoutMillis: 30 000) | New |
| `src/db/migrate.js` | `CREATE TABLE IF NOT EXISTS` for tree / person / relationship | New |
| `src/db/seed.js` | Reads `docs/seed.json` → upserts into DB | New |
| `src/routes/tree.js` | `GET /api/tree`, `PATCH /api/tree` (title) | New |
| `src/routes/persons.js` | `POST /api/persons`, `PATCH /api/persons/:id`, `DELETE /api/persons/:id` | New |
| `src/routes/relationships.js` | `POST /api/relationships`, `DELETE /api/relationships/:id` | New |
| `src/routes/transliterate.js` | `POST /api/transliterate` → Claude Haiku → 3–5 Devanagari options | New |
| `src/middleware/validate.js` | Input validation: name required, year range, UUID format | New |
| `public/index.html` | App shell: toolbar (toggle + zoom + export), viewport, sidebar, export `<dialog>` | New |
| `public/css/main.css` | Vintage theme, @font-face (Noto Sans Devanagari), layout grid | New |
| `public/css/sidebar.css` | Slide-in sidebar, chip styles, form fields | New |
| `public/js/main.js` | App init, immutable state store (`Object.freeze`), EN/HI lang toggle | New |
| `public/js/api.js` | Fetch wrappers for all REST calls; returns plain objects (never mutates state) | New |
| `public/js/tree-layout.js` | Reingold–Tilford top-down layout → `{id, x, y}[]`; single-root only | New |
| `public/js/tree-render.js` | Builds/patches SVG: nodes (`<g>`/`<rect>`/`<text>`), edges (`<path>`), border (`<rect>`) | New |
| `public/js/canvas.js` | Pan (drag on SVG bg), zoom (wheel + toolbar buttons), scrollbar sync | New |
| `public/js/sidebar.js` | Open/close form; context: new-root (bg click) or edit/add-child (context menu) | New |
| `public/js/transliterate.js` | 600 ms debounce, `Map` cache, chip render; reused for name + spouse fields | New |
| `public/js/export.js` | Serialize SVG → embed font as base64 in `<defs>` → draw to `<canvas>` → PNG or jsPDF A3 | New |
| `public/js/context-menu.js` | Right-click on node → menu: Add Child / Edit / Delete | New |
| `public/fonts/` | `NotoSansDevanagari-Regular.woff2` + `NotoSansDevanagari-Bold.woff2` (self-hosted) | New |
| `scripts/seed-pdf.js` | Step 0: convert PDF p.1 to PNG → Claude Vision → `docs/seed.json` | New |
| `tests/tree-layout.test.js` | Jest unit tests for layout algorithm | New |
| `tests/api.test.js` | Jest + Supertest integration tests for all 4 route files | New |

## Data Flow

### Primary path — add a person via context menu

```
1.  User right-clicks an existing node
2.  context-menu.js shows menu → user clicks "Add Child"
3.  sidebar.js opens with parentId pre-set, empty form
4.  User types English name
5.  transliterate.js debounces 600 ms → POST /api/transliterate
6.  transliterate.js route: Anthropic SDK → Claude Haiku
    prompt: "Give 3-5 Devanagari transliterations of '{name}' as a JSON array"
    response: ["राम", "रॉम", "रम", ...]
7.  Chips rendered in sidebar; user clicks one → Hindi field populated
8.  User fills optional fields (birth year, death year, spouse, gender, notes)
9.  sidebar.js → api.js → POST /api/persons → validate.js → pg INSERT → {id, ...}
10. api.js → POST /api/relationships {parentId, childId} → pg INSERT
11. api.js returns {person, relationship} → main.js merges state immutably
12. tree-layout.js recalculates all positions (Reingold–Tilford)
13. tree-render.js patches SVG: appends new <g> node + <path> edge(s)
```

### Secondary path — root node

```
1.  User clicks empty canvas background (tree is empty or adding a second root is
    blocked — single-root constraint enforced in sidebar.js if tree already has nodes)
2.  sidebar.js opens with parentId = null
3.  Same form flow as above; no relationship POST
```

### Export path

```
1.  User clicks Export → <dialog> opens: format (PNG/PDF) + language (EN/HI)
2.  export.js clones the live SVG element
3.  export.js injects Noto Sans Devanagari as base64 <style> inside <defs>
4.  If language = EN: strip Hindi <text> elements; if HI: strip English
5.  Serialize SVG to Blob URL → draw into off-screen <canvas> at 2× device ratio
6.  PNG: canvas.toBlob() → anchor download
7.  PDF: canvas.toDataURL('image/jpeg', 0.95) → jsPDF A3 landscape
         title block positioned top-centre, info box (family name + date) bottom-left
         matching vanshavali.pdf layout proportions
```

### Transliteration cache

```
transliterate.js (client) holds a Map<string, string[]>.
On keyup debounce: check cache first → if hit, render chips immediately (no API call).
Server-side: no cache needed (stateless route).
```

## File Targets

| File Path | Action | Description |
|-----------|--------|-------------|
| `server.js` | Create | Express entry point |
| `src/db/client.js` | Create | pg pool |
| `src/db/migrate.js` | Create | Schema DDL |
| `src/db/seed.js` | Create | Seed loader |
| `src/routes/tree.js` | Create | Tree title routes |
| `src/routes/persons.js` | Create | Person CRUD |
| `src/routes/relationships.js` | Create | Relationship CRUD |
| `src/routes/transliterate.js` | Create | Claude Haiku call |
| `src/middleware/validate.js` | Create | Input validation |
| `public/index.html` | Create | App shell |
| `public/css/main.css` | Create | Theme + @font-face |
| `public/css/sidebar.css` | Create | Sidebar + chips |
| `public/js/main.js` | Create | State store + init |
| `public/js/api.js` | Create | Fetch wrappers |
| `public/js/tree-layout.js` | Create | Layout algorithm |
| `public/js/tree-render.js` | Create | SVG renderer |
| `public/js/canvas.js` | Create | Pan / zoom |
| `public/js/sidebar.js` | Create | Form panel |
| `public/js/transliterate.js` | Create | Chips + debounce |
| `public/js/export.js` | Create | PNG / PDF export |
| `public/js/context-menu.js` | Create | Right-click menu |
| `public/fonts/NotoSansDevanagari-Regular.woff2` | Create | Self-hosted font |
| `public/fonts/NotoSansDevanagari-Bold.woff2` | Create | Self-hosted font |
| `scripts/seed-pdf.js` | Create | Step 0 seed script |
| `docs/seed.json` | Create (generated) | Output of seed-pdf.js |
| `.env.example` | Create | DATABASE_URL, ANTHROPIC_API_KEY, PORT |
| `.gitignore` | Create | node_modules, .env, docs/seed.json |
| `railway.toml` | Create | Railway deploy config |
| `package.json` | Modify | Deps + scripts |
| `tests/tree-layout.test.js` | Create | Layout unit tests |
| `tests/api.test.js` | Create | Route integration tests |

## External Touchpoints

| Service | Direction | Module |
|---------|-----------|--------|
| Claude Haiku API (transliteration) | Outbound from server | `src/routes/transliterate.js` |
| Claude Vision API (seed, one-time) | Outbound from script | `scripts/seed-pdf.js` |
| Railway PostgreSQL | Outbound from server | `src/db/client.js` |
| Browser File Download API | Client-side | `public/js/export.js` |

## DoD Traceability

| Requirement (DoD) | Architectural Component |
|-------------------|------------------------|
| Top-down pannable/zoomable canvas + scrollbars | `tree-layout.js` + `tree-render.js` + `canvas.js` |
| EN/HI canvas toggle | `main.js` (lang state) + `tree-render.js` (reads lang on render) |
| Editable tree title inline | `index.html` (contenteditable span) + `src/routes/tree.js` PATCH |
| Decorative border | `tree-render.js` (outermost SVG `<rect>` with double-stroke / dash pattern) |
| Click node → sidebar form | `tree-render.js` click handler → `sidebar.js` open(edit) |
| Background click → add root form | `canvas.js` bg-click handler → `sidebar.js` open(newRoot) |
| Right-click → context menu (Add Child / Edit / Delete) | `context-menu.js` + `tree-render.js` |
| English name required; all others optional | `sidebar.js` form validation + `validate.js` server-side |
| 3–5 transliteration chips (name) | `transliterate.js` (client) + `src/routes/transliterate.js` |
| Spouse chips same UX | `transliterate.js` (same module, second field instance) |
| Gender toggle → node colour (female = warm red) | `tree-render.js` (SVG `<rect>` fill by gender) |
| Auto-save to PostgreSQL on every change | `sidebar.js` → `api.js` → `persons.js` + `relationships.js` routes |
| Export dialog: format + language picker | `index.html` `<dialog>` + `export.js` |
| Full canvas captured at 2× resolution | `export.js` (SVG clone → base64 font inject → off-screen canvas 2×) |
| PNG download | `export.js` (canvas.toBlob → anchor) |
| PDF A3 landscape mirroring vanshavali.pdf | `export.js` (jsPDF A3, title block + info box positioned) |
| Noto Sans Devanagari locally served | `public/fonts/` + `main.css` @font-face + base64 embed in `export.js` |
| First load: render tree or show empty prompt | `main.js` (GET /api/tree → branch on empty state) |
| Seed: Claude Vision → seed.json | `scripts/seed-pdf.js` |
| Seed: npm run seed → PostgreSQL | `src/db/seed.js` |

## Test Strategy

- **Chosen:** TS1 — new test harness (no tests exist)
- **Framework:** Jest + Supertest
- **Rationale:** Fresh repo; algorithm and API are the highest-risk surfaces
- **Verification:**
  - `tests/tree-layout.test.js` — unit tests for layout algorithm: single node,
    linear chain, wide siblings, deep nesting, no overlap assertion
  - `tests/api.test.js` — Supertest integration against a test DB:
    create/read/update/delete for persons and relationships; transliterate route
    (mocked Claude response); tree title PATCH; seed loader
  - Coverage target: 80 % on `src/` and `public/js/tree-layout.js`
  - Browser rendering and export verified manually (no E2E framework for v1)

## Risks & Open Questions

| Risk | Mitigation |
|------|-----------|
| SVG→canvas: self-hosted font not rendering in serialized SVG blob | Embed Noto Sans Devanagari as base64 `@font-face` inside SVG `<defs>` before export; test in Chrome + Firefox |
| Wide trees (many siblings) push SVG very wide | Auto-fit viewBox on load; zoom-to-fit button in toolbar; min node width capped at 140 px |
| Claude API latency on transliteration chips feeling slow | Spinner appears instantly on keyup; client-side `Map` cache so repeat lookups are instant |
| seed-pdf.js: compressed CID fonts in PDF may confuse Claude Vision | Convert PDF p.1 to PNG using `canvas` npm pkg before sending; if Vision extraction is partial, supplement `seed.json` manually |
| Railway cold-start first query latency | pg pool `idleTimeoutMillis: 30 000`; Railway paid plan keeps containers warm |
| Single-root constraint: user may want two founding ancestors later | Data model already supports multi-root (no parent FK on person); constraint is in `sidebar.js` only — easy to lift in v2 |
| Drag-and-drop absent: user may accidentally need to restructure | Delete + re-add via context menu is the v1 workflow; consider drag in v2 if grandfather requests it |
