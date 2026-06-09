# Requirements: Vanshavali Builder

## Purpose

A personal web tool for building, editing, and exporting a traditional Indian
genealogical tree (वंशावली). Designed for a non-technical user (grandfather).
Hosted on Railway. No login required. Aesthetic: grounded, vintage, traditional —
matching the layout and style of `docs/vanshavali.pdf` and `docs/sample.png`.

## Definition of Done

### Tree Canvas
- [ ] Tree renders top-down on a pannable/zoomable canvas with visible scrollbars
- [ ] Default view shows English names; a toggle (EN / HI) switches the entire canvas to Hindi display and back
- [ ] Tree title editable inline (shown at top of canvas, e.g. "वंशावली: Katari Family")
- [ ] Decorative border surrounds the tree canvas at all times (matching vanshavali.pdf style)

### Node Interaction
- [ ] Click any node → sidebar panel slides in with the person's detail form
- [ ] Click canvas background (empty space) → panel to add a new root or child node
- [ ] Right-click or long-press node → context menu: Add Child, Edit, Delete

### Person Form (sidebar)
- [ ] Name (English) — required; all other fields optional
- [ ] Hindi name field: when user types English name, debounced (~600 ms) call to Claude Haiku returns 3–5 Devanagari transliteration options shown as clickable chips; user clicks a chip to accept or types into the Hindi field directly
- [ ] Birth year (number input)
- [ ] Death year (number input)
- [ ] Spouse name — English + Hindi (same transliteration chip UX)
- [ ] Gender toggle: Male / Female / Other (drives node colour: default = neutral, Female = warm accent matching sample.png red)
- [ ] Notes (short free-text)
- [ ] Save auto-persists to PostgreSQL; no manual Save button

### Export
- [ ] Export button opens a small dialog: choose format (PNG / PDF) and language (English / Hindi)
- [ ] Export captures the full canvas at 2× resolution (html2canvas scale: 2) — not just the viewport
- [ ] PNG: direct download via html2canvas
- [ ] PDF: A3 landscape, html2canvas → jsPDF; layout mirrors vanshavali.pdf (title block top-centre, tree body, info box bottom-left)
- [ ] Noto Sans Devanagari font embedded locally (not CDN) so html2canvas renders Hindi correctly

### Persistence
- [ ] Tree data auto-saves to PostgreSQL on every node add / edit / delete
- [ ] On first load: if DB has data, render it; if DB is empty, show empty canvas with a helper prompt

### Seed Data (Step 0 — pre-deploy, not a runtime feature)
- [ ] Before first deploy, one Claude Vision API call parses `docs/vanshavali.pdf` image → extracts all persons, relationships, and dates → saved as `docs/seed.json`
- [ ] A `npm run seed` script loads `docs/seed.json` into PostgreSQL
- [ ] This is a one-time developer operation; no import UI in the app

## [AMENDED] Pivot Round 2 (feedback 2026-06-01)

The following supersede/extend the DoD above:

### Tree Canvas
- [AMENDED] Header title is **language-aware**: EN mode shows `title_en`, HI mode shows `title_hi` (was: hardcoded Hindi).
- [AMENDED] **Compact top-down** packing: tighter gaps + denser leaf wrapping to fit more per screen (no reorientation).
- [ADDED] Subtle **generation differentiation** (faint per-depth banding; thicker border on the patriarch node).
- [ADDED] Toggleable **minimap** for navigating large trees.

### Node Interaction
- [AMENDED] Names **never truncate**: dynamic node width + 2-line wrapping (was: ellipsis clamp at ~22 chars).
- [ADDED] Each card shows an inline **edit (pencil) icon** and an **"+" add-child** affordance (hover/focus; always-on where hover absent).
- [ADDED] Toolbar **Add** form includes a **Parent dropdown** (pick any parent, or none = root).
- [ADDED] Visible **help hint** documenting mouse controls (pan/zoom/right-click/edit/add).

### Person / Spouse representation
- [AMENDED] Spouse rendered as a **paired couple box** beside the person, joined by a marriage connector — no "w./h." prefix (resolves husband mislabel).
- [AMENDED] Each box shows the person's own **birth/death year below the name**.
- [ADDED] Spouse gets its **own** `spouse_birth_year`, `spouse_death_year`, `spouse_gender`.
- [AMENDED] Spouse box colored by gender with **AA contrast** (was: low-contrast red text).

### Export
- [AMENDED] Export reliability fix: **self-hosted** jsPDF (+ canvg) instead of CDN; **canvg**-based SVG→canvas so embedded Devanagari font renders (was: fragile SVG-as-`<img>` + double-draw).
- [AMENDED] Export options shown as a **popover anchored to the Export button** (was: centered/left modal dialog).

## [ADDED] Pivot Round 4 (feedback 2026-06-02)

Additive scope — sibling ordering + form tweak. No prior DoD item is removed.

### Person Form (sidebar)
- [ADDED] `Living` checkbox renders **above** the Birth/Death year row (person
  section only; spouse block unchanged). Death-year reveal behaviour unchanged.
- [ADDED] **`Sequence`** — optional number input (integer ≥ 1), placed below the
  Birth/Death row, hint "order among siblings (1, 2, 3…)".

### Tree Canvas
- [ADDED] Siblings render in a deterministic order: **sequence ascending, then
  birth_year ascending**. Siblings with no sequence sort after numbered ones;
  among equal/absent keys, original DB order is preserved (stable).

### Data Model
- [ADDED] `person.sequence INTEGER` (nullable). Existing rows default to NULL and
  keep current behaviour until numbered.

## Decisions & Options

| Decision | Chosen Option | Alternatives Considered | Rationale |
|----------|--------------|------------------------|-----------|
| Backend | Node.js + Express on Railway | Serverless, Python | Simple, Railway-native |
| Database | PostgreSQL (Railway plugin) | SQLite, MongoDB | Railway-native, relational fits tree |
| Frontend | Vanilla JS + HTML/CSS (no framework) | React, Vue | Minimal complexity, no build step |
| Hindi input | Claude Haiku API — 3–5 transliteration chips on demand | Google Translate, indic-transliteration lib | Multiple options; quality; no extra API key |
| Bilingual display | EN/HI canvas toggle; language picker at export | Always bilingual side-by-side | Cleaner nodes; grandfather picks his view |
| Auth | None — single personal tool | Email/password, passphrase | Private Railway URL sufficient |
| Export | html2canvas (scale:2) + jsPDF client-side | Puppeteer server-side | No puppeteer dep on Railway; simpler deploy |
| Font embedding | Noto Sans Devanagari self-hosted (not CDN) | Google Fonts CDN | html2canvas cannot load CDN fonts reliably |
| PDF import | One-time dev-time Claude Vision call → seed.json | Runtime upload wizard, manual re-entry | Simpler app; grandfather's data is fixed |
| Tree layout | Custom recursive top-down (Reingold-Tilford variant) | D3-hierarchy, GoJS | Full visual control; no heavy deps |

## Data Model

```
tree
  id                  UUID PK
  title_en            TEXT
  title_hi            TEXT
  moderation_enabled  BOOLEAN NOT NULL DEFAULT FALSE  -- [ADDED] Cycle 2
  show_birth_year     BOOLEAN NOT NULL DEFAULT FALSE  -- [ADDED] 2026-06-07 global birth-year reveal
  created_at          TIMESTAMPTZ
  updated_at          TIMESTAMPTZ

person
  id            UUID PK
  tree_id       UUID FK → tree.id
  name_en       TEXT NOT NULL
  name_hi       TEXT
  birth_year    INTEGER
  death_year    INTEGER
  spouse_en     TEXT
  spouse_hi     TEXT
  spouse_birth_year   INTEGER   -- [AMENDED] added Pivot R2
  spouse_death_year   INTEGER   -- [AMENDED] added Pivot R2
  spouse_gender       TEXT      -- [AMENDED] added Pivot R2: 'M' | 'F' | 'other'
  gender        TEXT       -- 'M' | 'F' | 'other'
  sequence      INTEGER    -- [ADDED] Pivot R4: sibling order (≥1, nullable)
  death_year_hidden         BOOLEAN NOT NULL DEFAULT FALSE  -- [ADDED] 2026-06-07 admin force-hide person death year
  spouse_death_year_hidden  BOOLEAN NOT NULL DEFAULT FALSE  -- [ADDED] 2026-06-07 admin force-hide spouse death year
  notes         TEXT       -- [VISIBILITY] 2026-06-07: admin-only; omitted from public API
  x_pos         FLOAT      -- persisted layout hint
  y_pos         FLOAT

relationship
  id            UUID PK
  tree_id       UUID FK → tree.id
  parent_id     UUID FK → person.id
  child_id      UUID FK → person.id
```

## Constraints

- Must NOT: require login or account creation
- Must NOT: use a heavy frontend framework (React, Vue, Angular)
- Must NOT: make any field besides English name required
- Must NOT: call Claude API on every keystroke (debounce + cache chip results)
- Must: Noto Sans Devanagari served from `/public/fonts/` (not CDN) — required for html2canvas
- Must: work on desktop browsers (Chrome / Firefox / Edge); mobile not required
- Must: export captures full tree regardless of viewport scroll position
- Must: female nodes styled with warm accent (matching red in sample.png)
- Must: follow top-down layout and decorative border style of `docs/vanshavali.pdf`

## Out of Scope (v1)

- Multi-user access or family sharing
- Multiple trees per session
- Mobile / touch optimisation
- Undo / redo history
- Real-time collaboration
- Photo upload per person
- GEDCOM import/export
- Authentication / user accounts
- Runtime PDF import UI (handled as one-time dev seed)
- Repeat seed after initial import (can re-run `npm run seed` manually if needed)

## References

- `docs/vanshavali.pdf` — grandfather's existing record; source of seed data and layout reference
- `docs/sample.png` — Wiki Commons vanshavali; visual style reference (border, colours, font size hierarchy)
- Claude Haiku API — transliteration chips (3–5 options per name)
- Claude Vision API — one-time PDF parse for seed.json (Step 0 in execute phase)
- html2canvas — canvas capture; must use `scale: 2` and `useCORS: true`
- jsPDF — PDF generation from canvas image
- Noto Sans Devanagari — self-hosted under `/public/fonts/`
- Existing tools surveyed: VanshApp, Hamare Riste, FamilyRoot — all mobile-first / GEDCOM-focused; ours is print-quality desktop-first

---

# Requirements: Admin & Moderation (Feature Cycle 2 — 2026-06-06)

> New feature cycle, appended (not replacing) the completed v1 above. This
> introduces the project's **first authentication layer** plus a moderation
> (edit-approval) pipeline and version history. It deliberately **reverses** two
> v1 constraints — see the amendment note below.

## [AMENDED] v1 constraint reversal

- v1 "**Auth: None**" / "Must NOT require login" applied to *editing the public
  tree*. That stays true for visitors. But an **admin area is now login-gated.**
  Public tree viewing + (when moderation is OFF) editing remain login-free.
- v1 "Seed Data" + auto-seed are **retired** (see Cleanup section).

## Purpose

Let the family keep contributing edits while the tree owner retains control.
When **moderation** is enabled, anonymous visitors' edits become **pending
change requests** held for admin review instead of writing to the shared tree;
the contributor still sees their own edit locally (so they aren't confused),
labelled "submitted to admin for approval." Admins log in to a protected page to
**approve / edit-then-approve / reject** queued changes, **toggle moderation**,
and browse **version history** with one-click revert. The public landing page and
tree presentation are otherwise **unchanged**.

## Definition of Done

### Authentication (admin accounts)
- [ ] `admin_user` table: `id`, `username` UNIQUE, `password_hash` (bcrypt), `created_at`.
- [ ] First admin bootstrapped on migrate from `ADMIN_USERNAME` / `ADMIN_PASSWORD`
      env vars **only if no admin row exists** (idempotent; logs a warning if env
      unset and table empty).
- [ ] `POST /api/auth/login` (username+password) → sets a **signed JWT in an
      httpOnly, SameSite=Lax cookie**; wrong creds → 401 (generic message).
- [ ] `POST /api/auth/logout` clears the cookie.
- [ ] `GET /api/auth/me` → `{ username }` when authed, `401`/null otherwise.
- [ ] `requireAdmin` middleware guards every admin-only route (verifies JWT cookie).
- [ ] Admin page can create additional admins (username + password).

### Moderation setting
- [ ] `tree.moderation_enabled BOOLEAN NOT NULL DEFAULT FALSE` (idempotent ALTER).
- [ ] `GET /api/settings` (public) → `{ moderation_enabled }`.
- [ ] `PATCH /api/settings` (admin only) toggles it.
- [ ] Default **OFF** → behaviour identical to today until an admin turns it on.

### Change pipeline (single source for queue + history)
- [ ] `change_request` table: `id`, `tree_id`, `op_type` ('create'|'update'|'delete'),
      `entity` ('person'|'relationship'), `target_id` (nullable for create),
      `payload` JSONB (proposed fields), `before_snapshot` JSONB (captured at apply
      time, for revert/history), `status`
      ('pending'|'approved'|'rejected'|'applied'|'reverted'), `submitter_note` TEXT,
      `client_token` TEXT (links an anonymous submission to its browser),
      `resolved_by` UUID → admin_user (nullable), `submitted_at`, `resolved_at`.
- [ ] **Moderation OFF or requester is admin** → mutation writes through to
      `person`/`relationship` directly **and** records a `change_request` row with
      `status='applied'` + `before_snapshot` (so history captures *every* change).
- [ ] **Moderation ON and requester not admin** → mutation is **not** written to
      the live tables; a `change_request` row is created `status='pending'` with the
      caller's `client_token`; response signals "pending" (no live entity created).
- [ ] Person/relationship create returns enough info for the client overlay (the
      proposed payload + a pending request id) without a real DB id leaking as final.

### Admin review (admin page)
- [ ] `GET /api/changes?status=pending` (admin) → queue, newest first.
- [ ] `POST /api/changes/:id/approve` (admin) — optional edited `payload` in body;
      applies the mutation to live tables, captures `before_snapshot`, sets
      `status='applied'`, `resolved_by`, `resolved_at`.
- [ ] `POST /api/changes/:id/reject` (admin) → `status='rejected'` (+ resolved_by/at).
- [ ] `POST /api/changes/:id/revert` (admin) — restores `before_snapshot` to live
      tables and appends a **new** `status='applied'` (or `'reverted'`) audit row
      describing the revert. Only valid for previously-applied changes.

### Version history
- [ ] **Public main page:** read-only audit log via `GET /api/changes/applied`
      (applied + reverted rows, newest first: what/when/by-whom, before→after
      summary). Surfaced behind an unobtrusive "History" control; **no revert**.
- [ ] **Admin page:** same log **plus** the one-click **Revert** action.
- [ ] Full-tree snapshot/restore points are **OUT of scope v1** (noted as a future
      idea).

### Public landing / tree (minimal, presentation unchanged)
- [ ] Tree rendering, layout, palette, export — **no visual changes**.
- [ ] When moderation is ON and a visitor saves an edit: show a non-blocking
      "Submitted to admin for approval" toast/badge.
- [ ] **Optimistic local cache:** the visitor's pending edits are stored in
      `localStorage` keyed by a generated `client_token`, overlaid on the
      server tree on load so the contributor keeps seeing their own change with a
      "pending" marker. The shared tree other visitors load is unchanged.
- [ ] On load, client calls `GET /api/changes/mine?token=…` to reconcile: items
      now **applied** → drop the overlay (real data already reflects it);
      **rejected** → drop the overlay and show a brief "not approved" notice;
      still **pending** → keep the overlay marker.
- [ ] Admin browsing the public page (authed) sees live data with no overlay.

### Cleanup — retire seed functionality
- [ ] Remove `seedIfEmpty` + the `runSeed` import/call from `server.js`.
- [ ] Delete `src/db/seed.js` and `scripts/seed-pdf.js`.
- [ ] Remove the `seed` / seed-related scripts from `package.json`.
- [ ] **Keep** `docs/seed.json` as an offline data backup (no code references it).
- [ ] Tests/build stay green after removal (`npm test` → still passes).

## [ADDED] Admin-Curated Public View & Simplified Public Form (2026-06-07)

> Folded into Feature Cycle 2 **before execution** (depends on the admin-auth and
> `/api/settings` machinery introduced above). Members raised concerns about
> personal details being public and showed little appetite for filling them in.
> Resolution: the **public** experience collapses to a minimal contribute surface
> (name + gender + spouse name) with detail fields **admin-only**; detail data is
> **soft-hidden** from the public (kept in the DB, never deleted). The **admin**
> experience retains the full form and sees everything.
>
> **Supersedes** the interim "auto-flex always-on death year" wording: death year
> now shows publicly **only where a value is seeded** and the admin hasn't
> force-hidden it; birth year shows publicly **only when an admin reveals it**.

### Two-tier edit form (auth-aware) — the core change
- [ ] The card edit form renders in two modes, decided by `GET /api/auth/me`:
  - **Public (non-admin) form:** **Name (EN/HI + transliteration chips)**,
    **Gender**, **Spouse name (EN/HI + chips)**, **Spouse gender**. Nothing else.
  - **Admin form:** the **full** form as it exists today — adds Birth year, Death
    year, Living/deceased toggles, Sequence, Notes, plus the new visibility
    controls below.
- [ ] Fields absent from the public form (birth/death year, living, sequence,
      notes) are **never** present in the public DOM (not merely hidden) so they
      cannot be submitted by non-admins or via a crafted change request.
- [ ] Non-admin create/update payloads are **server-side whitelisted** to the
      public fields; any other field in the payload is ignored (defence in depth,
      especially under moderation).

### Default public card display
- [ ] A public card shows **Name + gender accent + death year where seeded**.
      No birth year, no notes by default.
- [ ] Death year on a public card renders **iff** a `death_year` (resp.
      `spouse_death_year`) value exists **and** the admin has not force-hidden it.
- [ ] Birth year renders on a public card **only when** the global reveal is ON.

### Birth Year — global admin reveal toggle (default HIDDEN)
- [ ] `tree.show_birth_year BOOLEAN NOT NULL DEFAULT FALSE` (idempotent ALTER).
      Default **FALSE** = no birth years anywhere public on first deploy.
- [ ] `GET /api/settings` (public) extends its payload with `show_birth_year`.
- [ ] `PATCH /api/settings` (admin only) toggles `show_birth_year` (alongside
      `moderation_enabled`).
- [ ] When FALSE: `b. YYYY` suppressed on every card (person + spouse); and
      `birth_year` / `spouse_birth_year` **omitted from public person API
      responses** (not merely CSS-hidden). When TRUE: both render/return again.
      Admin (authed) responses always include them.

### Death Year — public where seeded, admin per-card force-hide
- [ ] **Base rule:** a death year renders publicly wherever a value exists
      ("keep the ones seeded"). No admin action needed for the common case.
- [ ] **Admin override (per card):** `person.death_year_hidden BOOLEAN NOT NULL
      DEFAULT FALSE` and `person.spouse_death_year_hidden BOOLEAN NOT NULL DEFAULT
      FALSE` (idempotent ALTERs). When TRUE, that death year is **force-hidden**
      publicly even though a value exists.
- [ ] **Admin-only control:** a "Hide death year (admin)" checkbox in the admin
      form — one in the person section, one in the spouse section.
- [ ] **API exposure is auth-aware:** public person responses **omit** a
      force-hidden death year; **admin (authed)** responses include the death year
      **plus** the `*_death_year_hidden` flags.

### Notes — admin-only (soft-hidden)
- [ ] `notes` removed from the **public** form and **omitted from public** person
      API responses. Data stays in the DB; admins still edit/see it.

### Decisions for this sub-feature
| Decision | Chosen | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Public form scope | Name + Gender + Spouse name/gender | Name+Gender only; full form | Members will add people + spouses but not details; keeps contribution friction low |
| Detail fields (birth/death/living/seq/notes) | Admin-only; absent from public DOM + whitelisted server-side | CSS-hide; trust client | True soft-hide; non-admins can't submit them even under moderation |
| Birth year public | Hidden by default; global admin reveal toggle | Per-card; hard-remove | One switch addresses the concern; reversible without redeploy; "start hidden" = the default |
| Death year public | Show where seeded; admin per-card force-hide | Hidden-until-opt-in; always-on | Keeps seeded death years (deceased elders) visible; admin can suppress sensitive ones |
| Notes | Admin-only, kept in DB | Delete column; keep public | Non-destructive; removes a field nobody fills publicly |
| Hidden-data API exposure | Omit from public; include for admin | Always send + hide in CSS | Sensitive values never reach the public client |
| Storage | Soft-hide flags/setting; data stays in DB | Null/delete columns | Non-destructive; instantly reversible |

### Constraints for this sub-feature
- Must NOT: delete or null any `birth_year` / `death_year` / `notes` data — soft-hide only.
- Must NOT: emit birth year (when reveal OFF), a force-hidden death year, or notes
  to the **public** (unauthed) API surface.
- Must NOT: render detail-field inputs in the **public** form DOM.
- Must NOT: accept non-whitelisted fields from non-admin create/update requests.
- Must NOT: change the tree layout, palette, or card geometry — only which lines render.
- Must: keep the new column/setting migrations additive + idempotent.
- Must: default to birth-year reveal **OFF** and death-year force-hide **OFF** so a
  fresh deploy shows name + gender + seeded death years only.
- Must: gate the admin form + visibility controls on authenticated admin
  (`GET /api/auth/me`), server-verified — not client trust alone.

### Edge cases for this sub-feature
- Non-admin opens edit while moderation OFF → sees only Name/Gender/Spouse; saves
  write through (whitelisted) with no detail fields touched.
- Non-admin under moderation submits a crafted payload with `death_year` → server
  whitelist strips it before queuing; admin review never sees an injected detail.
- Card with no death_year value → nothing to show; force-hide flag is a harmless no-op.
- Birth-year reveal toggled ON→OFF → values reappear/disappear, no data change.
- Admin force-hides a death year while birth-year reveal is OFF and the person has
  no seeded death year → card renders name + gender only; layout must tolerate a
  card with no year line (it already does today).
- Admin editing the public page (authed) → sees the full admin form + all data.

---

## Decisions & Options

| Decision | Chosen Option | Alternatives Considered | Rationale |
|----------|--------------|------------------------|-----------|
| Auth model | Admin accounts table (bcrypt) | Shared env password; HTTP Basic | Multiple named admins; enables per-admin attribution in history |
| Session | Signed JWT in httpOnly cookie | Server session store; Basic Auth | Stateless, no store to run, easy logout |
| First admin | Bootstrap from env on migrate if table empty | Manual SQL insert; signup page | Zero-touch deploy; no public signup surface |
| Moderation default | OFF | ON | Preserve today's behaviour; owner opts in |
| Queue + history | One `change_request` table (every mutation logged) | Separate audit table; event sourcing | One pipeline; applied rows *are* the history; revert via before_snapshot |
| History depth | Public: log-only · Admin: log + per-change revert | Snapshots; no history | Matches owner's call; snapshots deferred |
| Anonymous identity | Random `client_token` in localStorage | Cookies; accounts for visitors | Lets a visitor track only their own submissions, no login |
| Pending cache life | Until admin resolves (reconcile on load) | Session-only; persist forever | Contributor never loses sight of their edit; self-heals on approve/reject |
| Seed.json | Keep file, remove all code paths | Delete entirely | Cheap offline backup of original data |
| New deps | `bcrypt` (or `bcryptjs`), `jsonwebtoken`, `cookie-parser` | hand-rolled crypto | Battle-tested; small footprint |

## Constraints

- Must NOT: change the public tree's visual presentation, layout, palette, or export.
- Must NOT: require login to view the tree, or to edit when moderation is OFF.
- Must NOT: write anonymous edits to live tables while moderation is ON.
- Must NOT: expose a public admin-signup route.
- Must NOT: hardcode admin credentials or JWT secret in source (env only:
  `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`).
- Must NOT: break the existing 32 tests or the additive/idempotent migration model.
- Must: keep all new migrations additive + idempotent (`CREATE TABLE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`) — railway.toml runs `migrate` before `start`.
- Must: hash passwords (bcrypt), never store plaintext; cookie httpOnly + SameSite.
- Must: validate all change-request payloads with the existing validators before apply.
- Must: keep API responses as raw objects (project convention — no envelopes).
- Must: degrade safely if `JWT_SECRET`/admin env are unset (admin area simply
  unusable; public app unaffected).
- [AMENDED 2026-06-07b] Should: be fully runnable locally without a Postgres
  install, via an in-memory mock DB (`pg-mem`) behind a `USE_MOCK_DB` flag, so
  admin features + UI can be click-tested before deploy. The mock path must not
  alter the real migration SQL or the production DB code path, and `USE_MOCK_DB`
  is never set in production.

## Edge Cases

- Approving a stale change whose target person was deleted meanwhile → reject-with-reason / 409, don't crash.
- Two pending edits to the same person → each applied independently in approval order; `before_snapshot` captured at *apply* time, not submit time.
- Delete approved after the row already changed → revert restores the captured snapshot.
- Visitor clears localStorage → loses their pending overlay (acceptable; server still holds the request).
- Moderation toggled OFF while items are pending → pending items remain reviewable; new edits write through.
- Admin edits while moderation ON → write through + logged as applied (admins bypass the queue).

## Out of Scope (v2)

- Full-tree snapshot / restore-to-point (future idea, acknowledged).
- Email notifications to admins about new submissions.
- Granular roles/permissions beyond "admin".
- Public visitor accounts / per-visitor profiles.
- Editing conflict-resolution UI (last-approved-wins is acceptable).
- Rate limiting (note: open submission endpoint — consider in a later pass).

## References

- `server.js` — wires routers; currently calls `seedIfEmpty` (to be removed).
- `src/routes/persons.js`, `src/routes/relationships.js` — mutation routes to gate.
- `src/db/migrate.js` — additive/idempotent migration pattern to follow.
- `src/middleware/validate.js` — reuse validators for change-request payloads.
- `public/js/api.js`, `public/js/main.js`, `public/js/sidebar.js` — client store +
  edit flow to layer the optimistic overlay + "pending" toast onto.
- `docs/seed.json` — retained backup; `src/db/seed.js`, `scripts/seed-pdf.js` — to delete.
- Memory: `feedback_api_shape` (raw objects), `feedback_design_palette`,
  `feedback_plan_first` (freeze plan before code).

## [AMENDED 2026-06-09 — Pivot R5] Life-status year visibility, edit-as-card, admin edit, no-op guard, ancestor lineage

> **Supersedes** the 2026-06-07 "Birth Year — global admin reveal toggle" and
> "Death Year — admin per-card force-hide" model. The single `tree.show_birth_year`
> flag and the per-card `person.death_year_hidden`/`spouse_death_year_hidden` flags
> are **retired** in favour of two life-status-keyed global toggles below.
> Implemented as amend/new phases 2.21–2.27 (2.20 remains deferred).

### Year visibility — two global toggles keyed off life-status (R5-1)
- [ ] Schema: `tree.show_years_deceased BOOLEAN NOT NULL DEFAULT FALSE` and
      `tree.show_birth_year_living BOOLEAN NOT NULL DEFAULT FALSE` (idempotent ALTERs).
- [ ] **Deceased person** (`deceased = true`): when `show_years_deceased` is ON, the
      public card shows **both birth and death years**; when OFF, neither.
- [ ] **Living person** (`deceased = false`): when `show_birth_year_living` is ON, the
      public card shows the **birth year only** (living people have no death year);
      when OFF, no year. A death year is **never** shown for a living person.
- [ ] Spouse mirrors the person rule, keyed off `spouse_deceased`.
- [ ] Both default **FALSE** (no years public on first deploy).
- [ ] `GET /api/settings` payload extends with both flags; `PATCH /api/settings`
      (admin only) toggles either/both alongside `moderation_enabled`.
- [ ] `serializePerson` rewritten to apply these rules; `notes` still always
      stripped for the public.

### Deceased years editable (R5-2)
- [ ] An admin can edit birth and death years for deceased people via the edit form.
      Living people: the death-year input is suppressed/ignored.

### Pending-edit diff view (R5-3)
- [ ] Pending edits in the admin moderation queue render as a readable **diff**
      (card / git-diff style, field-level `from → to`) instead of raw JSON, so the
      reviewer sees exactly what changed. Reuse the existing `diffHtml` helper
      (currently used only for resolved/history rows) for pending person edits.
      Phase 2.23.

### No-op guard (R5-4)
- [ ] An edit is only enqueued (moderation ON) or committed (moderation OFF / admin)
      when at least one field actually changed vs. the current record. No-op edits
      produce no queue entry and no history row. Enforced client-side (UX) and
      server-side (authoritative).

### Admin edit-any-card from the admin panel (R5-5)
- [ ] `/admin.html` gains a person picker/list + edit form that applies changes
      directly (admin path, subject to the no-op guard).

### Admin-editable ancestor lineage (R5-6, combines former R5-6 + R5-7) — Phase 2.26
- [ ] The ancestor line above the focal "Bade Lal Singh" is seeded to exactly, in
      sequence: Titay Singh → Jeevlal Singh → Shukan Singh → Gopal Singh →
      Rameshwar Singh (single parent→child chain), replacing whatever currently sits
      above the focal.
- [ ] The era **1840–1940** is surfaced on the ancestor strip (caption/label).
- [ ] The existing dotted connector from the last ancestor (Rameshwar) down into
      Bade Lal Singh is preserved.
- [ ] The line is **fully editable from the admin panel** (add/remove/reorder
      generations, edit name/years) — a managed control, not a one-time seed script —
      for future use cases. Chain integrity (single parent→child path to the focal)
      preserved; idempotent; verifiable on `dev:mock`.
