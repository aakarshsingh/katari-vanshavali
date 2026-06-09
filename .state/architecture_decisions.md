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

## [AMENDED] Pivot Round 2 — Architectural Notes (2026-06-01)

- **Layout engine** (`tree-layout.js`): now computes **per-node width** from measured text (memoized text-measure util) and a **couple-unit footprint** (person + spouse box + marriage gap). `computeGroupedLayout` consumes variable widths; compactness via tuned constants. Layout tests extended for variable width + couple footprint + no-overlap.
- **Renderer** (`tree-render.js`): paired couple boxes + marriage connector; birth/death below each name; generation banding + patriarch border; orthogonal ancestor connector; per-node hover affordances (edit pencil + add-child "+"). Export clone strips affordance elements.
- **Export** (`export.js`): switch from SVG→`<img>`→canvas (fonts don't load in `<img>`) to **canvg** rasterization honoring `document.fonts`; **self-host** jsPDF + canvg under `public/vendor/` (removes CDN failure mode). `await document.fonts.ready` before raster; cap dpr to browser canvas limits.
- **New module** `public/js/minimap.js`: scaled overview + draggable viewport rect; reuses `canvas.js` scale state.
- **Title i18n**: header reads `title_en`/`title_hi` by `state.lang`; `tree.js` PATCH accepts `title_hi`.
- **Schema**: `person` gains `spouse_birth_year`, `spouse_death_year`, `spouse_gender` (idempotent `ADD COLUMN IF NOT EXISTS`).
- **Export popover**: replace modal `<dialog>` with button-anchored popover.

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
    - [ADDED] Pivot R4 — sibling order cases: all-numbered (by sequence),
      mixed numbered/unnumbered (numbered first), birth-year tie-break
  - `tests/api.test.js` — Supertest integration against a test DB:
    create/read/update/delete for persons and relationships; transliterate route
    (mocked Claude response); tree title PATCH; seed loader
  - Coverage target: 80 % on `src/` and `public/js/tree-layout.js`
  - Browser rendering and export verified manually (no E2E framework for v1)

## [ADDED] Pivot R4 — Sibling Ordering

- **Single lever:** ordering is centralized in `buildAdjacency` (`tree-layout.js`),
  which already feeds every layout path (`computeLayout`, `computeGroupedLayout`,
  `splitTree`). Each child array is sorted there using a `personById` map.
- **Comparator:** `effSeq = sequence ?? Infinity`, `effBirth = birth_year ?? Infinity`;
  sort by `effSeq` asc, then `effBirth` asc, else `0` (stable → preserves DB order).
  Result: numbered siblings first (in number order), unnumbered last (by birth year).
- `tree-render.js`'s own `childrenOf` (collapse/descendant collection only) is left
  unsorted — it does not affect drawn positions, which come solely from the layout.

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

---

# Architecture: Phase 2 — Admin & Moderation

> Appended for Feature Cycle 2 (2026-06-06). Builds on the Phase 1 architecture
> above; nothing prior is replaced. Controlling inputs: the "Admin & Moderation"
> section of `requirements.md` and `conventions.md`.

## Overview

Phase 2 adds the project's first authentication layer (admin accounts via a
first-run signup, bcryptjs hashing, JWT in an httpOnly cookie) and an
edit-moderation pipeline. Every tree mutation is funnelled through a single
**apply service**; when `tree.moderation_enabled` is ON and the caller is not an
authenticated admin, the mutation is recorded as a **pending `change_request`**
instead of being written to the live tables. Anonymous contributors keep seeing
their own pending edits through a client-side **optimistic overlay** (localStorage
keyed by a random `client_token`) labelled "submitted for approval", while the
shared tree everyone else loads stays unchanged. Admins use a separate, unlinked
`/admin` page to log in, toggle moderation, review the queue
(approve / edit-then-approve / reject), and browse **version history** with
one-click revert. The `change_request` table is the single source for both the
queue and history — applied/reverted rows *are* the audit log. The public tree
page is visually unchanged except a non-blocking "submitted" toast and an
unobtrusive read-only History panel. Phase 1 seed code is retired.

## Module Breakdown

### Backend
| Module/Component | Responsibility | New or Modified |
|------------------|----------------|-----------------|
| `src/db/migrate.js` | Add `admin_user`, `change_request` tables; `tree.moderation_enabled` column. All additive + idempotent. No env credential bootstrap (first admin via signup). | Modified |
| `src/auth/credentials.js` | `hashPassword`/`verifyPassword` (bcryptjs); `signToken`/`verifyToken` (jsonwebtoken). Reads `JWT_SECRET`; if unset, generates a random per-boot secret (degraded: sessions don't survive restart). | New |
| `src/middleware/auth.js` | `attachAdmin` (reads JWT cookie → `req.admin` or null, never throws); `requireAdmin` (401 when no valid admin). | New |
| `src/services/mutations.js` | `applyChange({op_type, entity, target_id, payload})` — the **single writer** to `person`/`relationship`/`tree`, run inside a transaction (`pool.connect`); returns `{ before, after }`. Used by direct routes, approve, and revert. | New |
| `src/services/changelog.js` | `recordApplied({...})` and `recordPending({...})` — insert `change_request` rows; `summarize` helper for before→after diffs. | New |
| `src/routes/auth.js` | `GET /status` (`{needsSetup, authed}`), `POST /setup` (first admin only, hard-guarded), `POST /login`, `POST /logout`, `GET /me`, `POST /admins` (admin-only, create more admins). | New |
| `src/routes/settings.js` | `GET /` (public → `{moderation_enabled}`), `PATCH /` (admin → toggle). | New |
| `src/routes/changes.js` | `POST /` (submit pending), `GET /?status=pending` (admin queue), `GET /applied` (public, anonymized), `GET /mine?token=` (public, by client_token), `POST /:id/approve`, `/reject`, `/revert` (admin). | New |
| `src/routes/persons.js`, `relationships.js`, `tree.js` | On mutate: if moderation ON and `!req.admin` → create pending change_request (202); else `applyChange` + `recordApplied`. Reuse existing validators. | Modified |
| `server.js` | Mount `cookie-parser`, `attachAdmin`, new routers; remove `seedIfEmpty` + `runSeed` import/call. | Modified |

### Frontend
| Module/Component | Responsibility | New or Modified |
|------------------|----------------|-----------------|
| `public/admin.html` | Standalone admin page shell (login / signup / dashboard containers). | New |
| `public/js/admin/admin-api.js` | Fetch wrappers for auth/settings/changes (same-origin credentials). | New |
| `public/js/admin/admin-app.js` | View router: `status` → first-run signup / login / dashboard (moderation toggle, pending queue with approve/edit/reject, history + revert, add-admin). | New |
| `public/css/admin.css` | Admin page styling (vintage-consistent, isolated from main app). | New |
| `public/js/mutate.js` | **The chokepoint.** Intent fns `createPersonWithParent`, `updatePerson`, `deletePerson`, `updateTitle`. Reads `window.__moderation`; routes direct (`api.*`) vs queued (`POST /api/changes`); applies optimistic state + overlay; returns the new `{persons, relationships}` / pending marker. | New |
| `public/js/overlay.js` | localStorage overlay keyed by `client_token`; merge over server tree on load; `reconcile()` via `/api/changes/mine` (applied→drop, rejected→drop+notice, pending→keep); toast helper. | New |
| `public/js/history.js` | Public read-only History panel (`GET /api/changes/applied`). | New |
| `public/js/api.js` | Add auth/settings/changes wrappers; send `credentials:'same-origin'`. | Modified |
| `public/js/main.js` | `init` loads `GET /api/settings` + `GET /api/auth/me` → `window.__moderation = {enabled, admin}`; apply overlay inside `setState`; title edits via `mutate.updateTitle`; wire History panel. | Modified |
| `public/js/sidebar.js` | `handleSubmit`/`handleDelete` call `mutate.*` instead of `api.*` directly. | Modified |
| `public/js/context-menu.js` | `ctxDeletePerson` calls `mutate.deletePerson`. | Modified |
| `public/index.html` | Add History panel markup; include `mutate.js`, `overlay.js`, `history.js` (load order: after `api.js`, before `sidebar`/`context-menu`/`main`). | Modified |
| `package.json` | Add `bcryptjs`, `jsonwebtoken`, `cookie-parser`; remove `seed` / `seed:pdf` scripts. | Modified |

## Data Flow

**Anonymous edit, moderation ON (primary case):**
1. Visitor unlocks, edits a node, saves → `sidebar.handleSubmit` → `mutate.updatePerson(id, data)`.
2. `mutate` sees `window.__moderation.enabled && !admin` → `POST /api/changes` `{op_type:'update', entity:'person', target_id, payload, client_token, submitter_note}`.
3. Server `recordPending` inserts a `change_request` (status `pending`); returns `{id, status:'pending'}`.
4. `mutate` writes an overlay entry (request id + payload) to localStorage under `client_token`, applies the edit optimistically to `state`, shows a "Submitted to admin for approval" toast. Live DB untouched.
5. Admin → `/admin` → queue → optionally edits payload → **Approve** → `applyChange` (transaction): capture `before_snapshot`, write `person`, set row `status=applied`, `after_snapshot`, `resolved_by/at`.
6. Visitor reloads → `overlay.reconcile()` → `/api/changes/mine?token=` → item is `applied` → overlay dropped; refreshed `/api/tree` already reflects it.

**Admin (authed) or moderation OFF:** `mutate` calls the existing direct routes; server `applyChange` + `recordApplied` (before/after captured). No overlay. History still records it.

**Add-child under moderation:** a single bundled `change_request` (`entity:'person'`, `op_type:'create'`, payload includes `parent_id`); approve creates person **and** relationship atomically in one transaction. Revert of a create deletes both (from `after_snapshot`).

**First-run:** `/admin` → `GET /api/auth/status` → `needsSetup:true` → signup form → `POST /api/auth/setup` (allowed only while `admin_user` empty) → sets cookie → dashboard. Subsequent admins via dashboard `POST /api/auth/admins`.

## File Targets
| File Path | Action | Description |
|-----------|--------|-------------|
| `src/db/migrate.js` | Modify | Add admin_user, change_request, moderation_enabled (idempotent) |
| `src/auth/credentials.js` | Create | bcryptjs + JWT helpers |
| `src/middleware/auth.js` | Create | attachAdmin, requireAdmin |
| `src/services/mutations.js` | Create | applyChange transactional writer |
| `src/services/changelog.js` | Create | recordApplied/recordPending/summarize |
| `src/routes/auth.js` | Create | status/setup/login/logout/me/admins |
| `src/routes/settings.js` | Create | moderation get/toggle |
| `src/routes/changes.js` | Create | submit/list/applied/mine/approve/reject/revert |
| `src/routes/persons.js` | Modify | moderation branch |
| `src/routes/relationships.js` | Modify | moderation branch |
| `src/routes/tree.js` | Modify | moderation branch for title |
| `server.js` | Modify | cookie-parser, attachAdmin, mount routers, remove seed |
| `public/admin.html` | Create | admin page shell |
| `public/js/admin/admin-api.js` | Create | admin fetch wrappers |
| `public/js/admin/admin-app.js` | Create | admin view router + dashboard |
| `public/css/admin.css` | Create | admin styling |
| `public/js/mutate.js` | Create | mutation chokepoint |
| `public/js/overlay.js` | Create | optimistic localStorage overlay |
| `public/js/history.js` | Create | public history panel |
| `public/js/api.js` | Modify | auth/settings/changes wrappers |
| `public/js/main.js` | Modify | load moderation state, overlay, title via mutate |
| `public/js/sidebar.js` | Modify | route mutations via mutate |
| `public/js/context-menu.js` | Modify | route delete via mutate |
| `public/index.html` | Modify | history markup + script includes |
| `package.json` | Modify | add deps, drop seed scripts |
| `src/db/seed.js` | Delete | retire seed |
| `scripts/seed-pdf.js` | Delete | retire seed |
| `docs/seed.json` | Keep | offline data backup (no code refs) |
| `tests/auth.test.js` | Create | auth route tests |
| `tests/changes.test.js` | Create | moderation pipeline tests |

## Schema Additions (additive + idempotent)
```sql
ALTER TABLE tree ADD COLUMN IF NOT EXISTS moderation_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS admin_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS change_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID REFERENCES tree(id) ON DELETE CASCADE,
  op_type TEXT NOT NULL CHECK (op_type IN ('create','update','delete')),
  entity  TEXT NOT NULL CHECK (entity IN ('person','relationship','tree')),
  target_id UUID,                       -- null for create
  payload JSONB,                        -- proposed fields
  before_snapshot JSONB,                -- captured at apply time (revert source)
  after_snapshot  JSONB,                -- captured at apply time (e.g. created ids)
  status TEXT NOT NULL DEFAULT 'pending'
         CHECK (status IN ('pending','approved','rejected','applied','reverted')),
  submitter_note TEXT,
  client_token TEXT,                    -- links an anonymous submission to its browser
  resolved_by UUID REFERENCES admin_user(id),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_change_request_status ON change_request(status);
CREATE INDEX IF NOT EXISTS idx_change_request_token  ON change_request(client_token);
```

## External Touchpoints
- **Cookies:** httpOnly, SameSite=Lax JWT session (~7-day expiry); cleared on logout.
- **Env (Railway):** `JWT_SECRET` (recommended; random per-boot fallback if unset). `ANTHROPIC_API_KEY` unchanged. `ADMIN_USERNAME`/`ADMIN_PASSWORD` no longer used.
- **New npm deps:** `bcryptjs` (pure-JS — no native build on Railway), `jsonwebtoken`, `cookie-parser`.
- **Migration:** `railway.toml` runs `npm run migrate && npm start`; new tables created on next deploy.
- All other changes internal.

## DoD Traceability
| Requirement (DoD group) | Architectural Component |
|--------------------------|-------------------------|
| admin_user table + first-run signup + add-admin | `migrate.js`, `auth/credentials.js`, `routes/auth.js` (status/setup/admins) |
| login/logout/me + httpOnly JWT cookie | `routes/auth.js`, `auth/credentials.js`, `middleware/auth.js` |
| requireAdmin guards admin routes | `middleware/auth.js` applied in settings/changes/auth routes |
| moderation_enabled setting + toggle (default OFF) | `tree.moderation_enabled`, `routes/settings.js`, `mutate.js` |
| change_request table (queue + history) | schema, `services/changelog.js` |
| write-through + log every change (admin/OFF) | `routes/{persons,relationships,tree}.js`, `services/mutations.js`, `recordApplied` |
| queue anonymous edits when moderation ON | mutation routes branch + `routes/changes.js` `POST /`, `recordPending` |
| admin review approve / edit-then-approve / reject | `routes/changes.js`, `admin-app.js` |
| one-click revert (admin) | `routes/changes.js` `/revert`, `applyChange` with before_snapshot, `admin-app.js` |
| public read-only audit log (anonymized) | `GET /api/changes/applied`, `history.js` |
| presentation unchanged + "submitted" toast | `mutate.js`, `overlay.js`, no render changes |
| optimistic local cache + reconcile | `overlay.js`, client_token, `GET /api/changes/mine`, `main.js` |
| title edits queued (entity='tree') | `mutate.updateTitle`, `routes/tree.js` branch |
| cleanup: remove seed | `server.js`, delete `src/db/seed.js` + `scripts/seed-pdf.js`, `package.json` |

## Test Strategy
- **Chosen:** TS2 — extend existing jest + supertest harness (`pool.query` mocked; 32 tests passing).
- **Rationale:** Backend is well-covered by the existing pattern; adding routes/services fits cleanly. No frontend DOM test harness exists; building one for the overlay is out of scope this cycle.
- **Verification:**
  - `tests/auth.test.js`: setup creates first admin only when empty (409 otherwise); login success/failure; `me`; `requireAdmin` returns 401 without cookie.
  - `tests/changes.test.js`: submit → pending; approve → applies + records before/after; reject; revert restores snapshot; `/applied` omits admin identity; `/mine` filters by token; persons route branches pending vs applied by moderation flag + admin.
  - Add a `pool.connect` mock (returns `{query, release}`) for transactional `applyChange`.
  - Keep all 32 existing tests green; target ≥80% statements on new backend modules.
  - Manual on Railway: first-run signup, toggle moderation, anonymous edit → toast + overlay persists across reload, approve → appears for all, reject → overlay drops with notice, revert, public history panel, admin add-admin. Confirm tree presentation visually identical.

## Risks & Open Questions
| Risk | Mitigation |
|------|------------|
| Transaction mocking complexity in tests | Thin reusable `pool.connect` mock helper; keep `applyChange` query sequence simple |
| Optimistic create temp-id ≠ approved real id | Overlay is transient; dropped on reconcile; refreshed `/api/tree` is source of truth (no id reconciliation) |
| Stale approval (target deleted before approve) | `applyChange` detects missing target → 409; queue item marked rejected-with-reason |
| `mutate.js` refactor touches 3 client files (main correctness risk) | No client unit tests → covered by manual verification checklist; keep intent fns returning the same state shape sidebar already builds |
| `JWT_SECRET` unset in prod | Random per-boot fallback keeps app working; log a warning recommending a stable secret |
| Open submission endpoint, no rate limiting | Accepted/deferred per architect (internal family site); noted in requirements Out of Scope v2 |
| Public signup abuse | `POST /setup` hard-guarded to empty table only; all later admins created by authed admins |

---

# Architecture: Admin-Curated Public View & Simplified Public Form (2026-06-07)

> Folded into Feature Cycle 2 **before execution**. Controlling input: the
> "Admin-Curated Public View & Simplified Public Form" section of
> `requirements.md` (2026-06-07). Builds directly on the Phase 2 auth + settings +
> mutation machinery above; nothing prior is replaced.

## Overview

A single **auth-aware serializer** on the server is the one control point for what
each client sees: admins (verified via the Phase 2 `attachAdmin` middleware) get
the full person row; the public gets a stripped view. The frontend **render path
is untouched** — `node-metrics.boxSpec` already builds the card's year line from
whatever `birth_year`/`death_year` the API sends, and card height is **uniform**
regardless of the year line (`uniformHeight()` always reserves the meta row), so
omitting fields server-side produces the desired display with **zero layout or
render-code change**. The card **edit form** renders two-tier: the public form is
trimmed to Name + Gender + Spouse name/gender by **removing the detail-field group
from the DOM** for non-admins, and a server-side **whitelist** independently drops
any non-public field from non-admin writes (defence in depth, incl. under
moderation). Schema adds one global setting (`tree.show_birth_year`) and two
per-card admin flags (`person.death_year_hidden`, `person.spouse_death_year_hidden`).

## Module Breakdown

| Module/Component | Responsibility | New or Modified |
|------------------|----------------|-----------------|
| `src/serializers/person.js` | **The display control point.** `serializePerson(row, {isAdmin, showBirthYear})`: admin → full row incl. `*_death_year_hidden` flags; public → strip `birth_year`/`spouse_birth_year` when `!showBirthYear`, strip `death_year` when `death_year_hidden`, strip `spouse_death_year` when `spouse_death_year_hidden`, always strip `notes` and both `*_hidden` flags. `serializePersons(rows, opts)` maps a list. | New |
| `src/lib/public-fields.js` | `pickPublicFields(body)` — whitelist `{name_en, name_hi, spouse_en, spouse_hi, spouse_gender, gender}`; returns a new object with only present whitelisted keys. Single source reused by direct writes + queued submissions. | New |
| `src/middleware/validate.js` | Add `requireBoolean(field)` (optional boolean) for `death_year_hidden` / `spouse_death_year_hidden`. | Modified |
| `src/routes/tree.js` (GET `/`) | Map persons through `serializePersons` using `req.admin` + `tree.show_birth_year`. Tree row already loaded; pass `show_birth_year` from it. | Modified |
| `src/routes/persons.js` | POST/PATCH: if `!req.admin`, reduce body via `pickPublicFields` before insert/update (detail fields untouched on PATCH = preserved). Admin may set the two hide flags (validated). All responses serialized with `req.admin` + current `show_birth_year`. | Modified |
| `src/routes/settings.js` (Phase 2) | `GET /` payload adds `show_birth_year`; `PATCH /` (admin) accepts/toggles `show_birth_year` alongside `moderation_enabled`. | Modified |
| `src/routes/changes.js` (Phase 2) | On non-admin submit (`POST /`), reduce `payload` via `pickPublicFields` before queuing so a crafted payload can't inject detail fields into the review queue. | Modified |
| `src/services/mutations.js` (Phase 2) | `applyChange` **update** path must **merge** payload onto the existing row (partial update), never full-replace — preserves admin-entered detail when a whitelisted public edit is approved. | Modified (constraint) |
| `src/db/migrate.js` | Idempotent: `ALTER TABLE tree ADD COLUMN IF NOT EXISTS show_birth_year BOOLEAN NOT NULL DEFAULT FALSE;` and the two `person.*_death_year_hidden` columns. | Modified |
| `public/index.html` | Wrap birth/death/living/sequence/notes/spouse-year inputs in a single `#admin-fields` container; add two admin-only "Hide death year" checkboxes (`#f-hide-death`, `#f-spouse-hide-death`) inside the person/spouse sections. | Modified |
| `public/js/sidebar.js` | On `initSidebar`, if `!window.__moderation.admin` → remove `#admin-fields` from the DOM. `getSidebarEls`/`populateForm`/`collectForm` null-guard the now-optional elements; admin path reads/writes the two hide checkboxes. | Modified |
| `public/js/main.js` (Phase 2) | Already loads `window.__moderation = {enabled, admin}`; the form tier + serializer rely on it. No new load needed beyond ensuring it resolves before the sidebar initializes. | Modified (ordering note) |
| `public/js/admin/admin-app.js` (Phase 2) | Dashboard adds a "Show birth year" toggle (PATCH `/api/settings`) beside the moderation toggle. | Modified |
| `public/js/tree-render.js`, `node-metrics.js` | **Unchanged** — display is fully driven by serialized data. | Unchanged |

## Data Flow

**Public tree load:**
1. `GET /api/tree` → `attachAdmin` sets `req.admin` (null for visitors).
2. Handler loads `tree` (has `show_birth_year`) + persons.
3. `serializePersons(rows, {isAdmin: !!req.admin, showBirthYear: tree.show_birth_year})`.
4. Client `cardSpec → boxSpec → formatYears` renders name + gender + (death year
   only if the serializer included it). Birth year appears only when reveal ON.

**Admin on the public page:** same route; `req.admin` truthy → serializer returns
full rows → admin sees all years/notes. The sidebar (admin) keeps `#admin-fields`.

**Non-admin edit (moderation OFF):** `sidebar.collectForm` (public tier) sends only
public keys → `persons.PATCH` also `pickPublicFields` → partial UPDATE → detail
columns untouched → response serialized (public).

**Non-admin edit (moderation ON):** `mutate` → `POST /api/changes` → `pickPublicFields`
on payload → queued. Admin approve → `applyChange` **merge** update → admin detail
preserved.

**Admin sets per-card death-year visibility:** admin form → `persons.PATCH` with
`death_year_hidden`/`spouse_death_year_hidden` (validated booleans) → stored → public
serializer strips that card's death year thereafter.

## File Targets
| File Path | Action | Description |
|-----------|--------|-------------|
| `src/serializers/person.js` | Create | Auth-aware field stripping (the display control point) |
| `src/lib/public-fields.js` | Create | `pickPublicFields` whitelist |
| `src/middleware/validate.js` | Modify | `requireBoolean` for hide flags |
| `src/db/migrate.js` | Modify | Add `show_birth_year` + two `*_death_year_hidden` (idempotent) |
| `src/routes/tree.js` | Modify | Serialize persons on GET |
| `src/routes/persons.js` | Modify | Non-admin whitelist; admin hide flags; serialize responses |
| `src/routes/settings.js` | Modify | `show_birth_year` in GET + PATCH |
| `src/routes/changes.js` | Modify | Whitelist non-admin submission payloads |
| `src/services/mutations.js` | Modify | Ensure update is merge (partial), not replace |
| `public/index.html` | Modify | `#admin-fields` wrapper + two hide-death checkboxes |
| `public/js/sidebar.js` | Modify | Two-tier form; remove `#admin-fields` for non-admins; null-guards |
| `public/js/admin/admin-app.js` | Modify | "Show birth year" dashboard toggle |
| `tests/serializer.test.js` | Create | Serializer field-stripping matrix |
| `tests/persons.test.js` | Modify | Non-admin whitelist + admin hide-flag set |
| `tests/settings.test.js` | Modify | `show_birth_year` default/expose/toggle-gated |

## Schema Additions (additive + idempotent)
```sql
ALTER TABLE tree   ADD COLUMN IF NOT EXISTS show_birth_year          BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE person ADD COLUMN IF NOT EXISTS death_year_hidden        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE person ADD COLUMN IF NOT EXISTS spouse_death_year_hidden BOOLEAN NOT NULL DEFAULT FALSE;
```

## External Touchpoints
- None new. Reuses Phase 2 `attachAdmin`/cookie auth and `/api/settings`. All other
  changes internal. No new deps.

## DoD Traceability
| Requirement (DoD) | Architectural Component |
|--------------------|-------------------------|
| Public form = Name + Gender + Spouse name/gender only | `#admin-fields` removed for non-admins (`sidebar.js`); `pickPublicFields` server guard |
| Detail fields absent from public DOM + whitelisted server-side | `sidebar.js` DOM removal + `src/lib/public-fields.js` in persons + changes routes |
| Public card = name + gender + death year where seeded | `serializePerson` (default keeps existing death year) + unchanged render path |
| Birth year hidden by default; global admin reveal | `tree.show_birth_year` (default FALSE), `settings.js`, `serializePerson`, `admin-app.js` toggle |
| Death year per-card admin force-hide | `person.*_death_year_hidden`, admin checkboxes, `serializePerson` strip |
| Notes admin-only | `serializePerson` strips `notes` for public; admin form retains |
| Auth-aware API exposure (omit for public, include for admin) | `serializePerson({isAdmin})` in `tree.js` + `persons.js` |
| No layout/palette/geometry change | render path untouched; uniform card height already reserves meta row |
| Migrations additive + idempotent | `migrate.js` `ADD COLUMN IF NOT EXISTS` |
| Admin detail preserved on approve of public edit | `applyChange` merge-update semantics |

## Test Strategy
- **Chosen:** TS2 — extend the existing jest + supertest harness.
- **Rationale:** Serializer + whitelist + settings are pure/route logic that fits
  the mocked-`pool` pattern; the two-tier form has no DOM harness (manual, as Phase 2).
- **Verification:**
  - `tests/serializer.test.js`: admin → full row incl. flags; public with
    `showBirthYear=false` → no birth fields; `death_year_hidden=true` → no
    `death_year` (spouse symmetric); `notes` always stripped for public; flags
    never leak to public.
  - `tests/persons.test.js`: non-admin POST/PATCH with detail fields → persisted row
    unchanged on those columns (whitelist drops them); admin PATCH sets hide flags;
    responses serialized per requester.
  - `tests/settings.test.js`: `GET` includes `show_birth_year` (default false);
    `PATCH` toggling it requires admin (401 otherwise).
  - Keep all existing tests green; ≥80% on new modules.
  - Manual (Railway): birth years absent by default; admin reveal toggle flips them
    globally; seeded death years visible; admin force-hide removes one card's death
    year publicly while admin still sees it; non-admin form shows only
    name/gender/spouse; admin form full; tree layout visually identical.

## [AMENDED 2026-06-07b] Local Mock DB for Dev/Test

- **Decision:** Add an in-memory Postgres (`pg-mem`, devDependency) so the full
  app — admin auth, moderation queue, version history, field-visibility — runs
  locally with **no Postgres install**. Goal: click-test admin features + UI
  before Railway deploy.
- **Mechanism:** `src/db/mock-pool.js` (new) builds a `pg-mem` instance and
  returns a pg-compatible `Pool` via its `createPg()` adapter. `src/db/client.js`
  branches on `process.env.USE_MOCK_DB` — mock pool when set, real `pg.Pool`
  otherwise. The real production path is byte-for-byte unchanged when the flag is
  absent. Launch via `scripts/dev-mock.js` (sets the flag, then requires
  `server.js`) → `npm run dev:mock`. Cross-platform; no `cross-env` dep.
- **Behaviour:** server's existing boot path runs migrations then auto-seeds from
  `docs/seed.json` against the in-memory DB. Data is ephemeral (resets each
  restart) — acceptable and desirable for iterative UI testing.
- **Risk:** `pg-mem` may not implement every PG feature the schema uses
  (`gen_random_uuid()`/pgcrypto, `ON CONFLICT`, `ALTER … IF NOT EXISTS`). Mitigation:
  register/shim the needed functions in `mock-pool.js` during execute; this is the
  primary acceptance gate for Phase 2.8a. If a construct is unsupported, shim it in
  the adapter — never alter the real migration SQL.
- **Scope guard:** dev/test only. Not bundled into the deploy path; `USE_MOCK_DB`
  is never set on Railway.

## Risks & Open Questions
| Risk | Mitigation |
|------|------------|
| Admin on public page must get full data | `attachAdmin` runs before the tree route (Phase 2 mount order); serializer keys off `req.admin` |
| Approve of a public edit could wipe admin detail | `applyChange` update is **merge/partial**, not full-replace; covered by a test |
| Queued payload could smuggle detail fields | `pickPublicFields` applied in `changes.js` submit path, not only direct routes |
| "Not in public DOM" vs hidden | Non-admins have `#admin-fields` **removed** from DOM; `collectForm`/`populateForm` null-guard |
| Serializer must wrap **every** path persons are emitted | Audited paths: `tree.js` GET + `persons.js` POST/PATCH responses; change-history summaries already anonymized (no raw person emit) |
| Boolean flag coercion (`'false'` string) | `requireBoolean` validates true booleans; routes coerce explicitly |

# [AMENDED 2026-06-09 — Pivot R5] Life-status visibility, edit-as-card, admin edit, no-op guard, lineage

> Supersedes the 2026-06-07 "Admin-Curated Public View" visibility mechanism. The
> serializer's single `show_birth_year` param and the per-card `*_death_year_hidden`
> flags are replaced by two life-status-keyed global flags. Other 2026-06-07
> machinery (`pickPublicFields` whitelist, two-tier form, `applyChange` merge,
> serializer-as-sole-control-point) is **retained**.

## Visibility model (replaces global reveal + per-card hide)
- **Schema (additive, idempotent):**
  ```sql
  ALTER TABLE tree ADD COLUMN IF NOT EXISTS show_years_deceased     BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE tree ADD COLUMN IF NOT EXISTS show_birth_year_living  BOOLEAN NOT NULL DEFAULT FALSE;
  ```
  The 2026-06-07 columns (`tree.show_birth_year`, `person.death_year_hidden`,
  `person.spouse_death_year_hidden`) are left in place (additive history; harmless)
  but **no longer read** by the serializer. Migration adds the two new columns only.
- **`serializePerson(row, { isAdmin, showYearsDeceased, showBirthYearLiving })`** —
  admin → full row. Public:
  - person deceased → keep `birth_year`+`death_year` iff `showYearsDeceased`, else strip both.
  - person living → keep `birth_year` iff `showBirthYearLiving`; always strip `death_year`.
  - spouse symmetric on `spouse_deceased` / `spouse_birth_year` / `spouse_death_year`.
  - `notes` and the legacy `*_hidden` flags always stripped for public.
- **Routes:** `tree.js` GET and `persons.js` responses pass both flags from the
  loaded `tree` row. `settings.js` GET exposes both; PATCH whitelists both
  (`BOOLEAN_SETTINGS` extended) — old `show_birth_year` accepted-but-ignored or dropped.

## Pending-edit diff view (R5-3)
- The admin moderation queue (`admin-app.js` `renderQueue`) currently dumps the
  proposed `payload` as a raw JSON textarea. Re-render pending **person edits** as a
  field-level before→after diff (reuse the existing `diffHtml(before, after)` helper
  already used for resolved/history rows): `before` = current record, `after` =
  payload; show `label: from → to` for changed keys only. Create/delete stay as
  readable summaries. Editable JSON textarea may remain secondary for
  approve-with-edits (decide in execute). Reuses `.diff/.diff-from/.diff-to` CSS.
- **Edit-form year behaviour** (rides with 2.21A on the client, not a separate card
  restyle): deceased → birth+death year inputs editable; living → death-year input
  suppressed. The form is **not** restyled into a card (that earlier reading was
  dropped per 2026-06-09 feedback).

## No-op guard (R5-4)
- **Client** (`sidebar.js`/`mutate.js`): build the candidate payload, compare each
  key to the current record; if no field differs, skip the call and toast "no changes".
- **Server** (authoritative): in `persons.js` PATCH and `changes.js` submit, load the
  current row and drop keys equal to current; if the resulting diff is empty →
  no UPDATE / no queue insert / no history row; respond 200 with the unchanged row
  (or 204), never creating a phantom change_request.

## Admin edit-any-card (R5-5)
- `/admin.html` + `admin-app.js`: new "People" view — list persons (`GET /api/tree`
  with admin cookie → full rows), pick one, edit in the card form, `PATCH
  /api/persons/:id` (admin, direct apply, no-op-guarded). `admin-api.js` gains
  `listPersons`/`updatePerson` wrappers. Reuses existing admin auth + serializer.

## Ancestor lineage (R5-6)
- **Data:** `splitTree` already derives the ancestor strip by walking single-child
  links from the root down to "Bade Lal Singh". So the change is **data**: ensure the
  rows above the focal are exactly Titay→Jeevlal→Shukan→Gopal→Rameshwar (one
  parent→child chain), with `birth_year`/`death_year` spanning 1840–1940. Idempotent
  data-fix script (match by name; create/relink as needed) run on `dev:mock` then prod.
- **Render:** `tree-render.js` `renderAncestorStrip` gains a small **"1840–1940"**
  caption near the strip. Dotted orthogonal connector (Rameshwar → Bade Lal Singh)
  already exists — unchanged. No layout-engine change.

## Test strategy (R5)
- Extend jest+supertest: rewrite `tests/serializer.test.js` for the two-flag matrix
  (deceased on/off, living on/off, spouse symmetry, notes always stripped); extend
  `tests/persons.test.js` + settings tests for the new flags and the no-op guard
  (PATCH with identical fields → no change_request / no history). Lineage data-fix +
  card restyle + admin People view verified on `dev:mock` (manual, browser), per
  prior frontend phases.

## Open question deferred to execute
- Whether to physically drop the legacy `show_birth_year`/`*_death_year_hidden`
  columns (a destructive migration) or leave them dormant. **Default: leave dormant**
  (additive-only convention); revisit only if cleanup is requested.
