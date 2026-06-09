# Resume

## ▶ Phase 2 — Admin & Moderation (ACTIVE, started 2026-06-06)

Net-new feature cycle on top of completed Phase 1 (below). Workflow position:
**scope ✅ → design ✅ → plan ✅ → execute (2.0–2.19 + 2.8a DONE) → 2.20 deferred → Pivot R5 (new feedback) NEXT.**

> ▶ EXECUTION: **2.0–2.19 ALL DONE and committed.** Backend + client moderation
> pipeline + local pg-mem committed (2026-06-07). **2.12 (public history) + 2.13
> (admin page) committed `819e8af`; 2.14–2.17 (field-visibility / API-lockdown
> serializer) committed `412621a`; 2.18 (two-tier edit form) + 2.19 (admin "Show
> birth year" toggle) committed `6d0976f`.** **107/107 tests green.**
> **2.20** (manual local round-trip on dev:mock) is **deferred** by user — do later.
> **NEXT = Pivot R5:** new feedback (2026-06-09) — seed Katari lineage (Titay→
> Jeevlal→Shukan→Gopal→Rameshwar, 1840–1940); show+edit birth/death years for
> deceased, hide years for living; render pending edits as a readable diff (not raw
> JSON); add admin edit-any-card with a no-op guard (queue an edit only if fields
> actually changed); admin-editable ancestor lineage.
> Run `/as-p7-pivot` to append phases, then `/as-p5-execute` per phase.
>
> ✅ **SECURITY GAP CLOSED (2.14–2.17):** the public/unauthenticated API no longer
> returns hidden fields. `notes` + hide flags always stripped; `birth_year` gated by
> `tree.show_birth_year` (default OFF); `death_year` per-card force-hide; non-admin
> writes whitelisted (direct routes + moderation queue); approvals partial-merge so
> admin detail survives. Single read chokepoint = `src/serializers/person.js`; single
> write gate = `pickPublicFields` (`src/lib/public-fields.js`). 107/107 tests.
>
> Note (2.12): history-panel styling lives in `css/main.css` (not JS-injected) per
> user feedback — default new component styling to the CSS files. See memory
> `feedback_styles_in_css`.
> Note (2.13): admin UI is served at **`/admin.html`** (static); admin history shows
> resolved-timestamp attribution, not username (no admin-lookup endpoint yet).
> Note (2.16/2.17): settings tests live in `tests/changes.test.js` (no settings.test.js);
> hide-flag columns added to `mutations.PERSON_FIELDS`; `tests/persons.test.js` created.
>
> ✚ AMENDED 2026-06-07: folded in **Admin-Curated Public View & Simplified Public
> Form** before execution. Plan is now **20 phases (2.0–2.19)**. New phases
> 2.14–2.19 cover: visibility schema (`tree.show_birth_year`,
> `person.death_year_hidden`, `person.spouse_death_year_hidden`); auth-aware person
> serializer + `pickPublicFields` whitelist + `requireBoolean`; wiring into tree
> GET/persons routes; settings birth-year toggle + changes whitelist + `applyChange`
> merge; two-tier edit form (public = name+gender+spouse, detail removed from DOM);
> admin "Show birth year" dashboard toggle. Defaults: birth-year reveal OFF,
> death-year shows where seeded, per-card admin force-hide, notes admin-only.

- **Requirements:** `.state/requirements.md` → section "Admin & Moderation (Feature Cycle 2)".
- **Architecture:** `.state/architecture_decisions.md` → section "Phase 2 — Admin & Moderation".
- **Scope:** admin accounts (first-run signup + add-admin), JWT httpOnly cookie,
  bcryptjs; moderation toggle (default OFF) on `tree`; single `change_request`
  table = queue + version history; `mutate.js` client chokepoint; optimistic
  localStorage overlay + "submitted for approval" toast; separate unlinked
  `/admin` page; queued title edits; anonymized public history; revert (admin);
  remove seed code (keep `docs/seed.json`).
- **Key decisions:** auth=accounts table; moderation default OFF; history =
  public log-only + admin revert; pending cache reconciled until admin resolves;
  rate limiting deferred (internal site); new deps bcryptjs/jsonwebtoken/cookie-parser.
- **Plan:** `.state/execution_plan.md` → section "Execution Plan: Phase 2 — Admin & Moderation" (20 phases, 2.0–2.19; 2.14–2.19 = field-visibility amendment).
- **Next action:** Phases **2.0–2.11 + 2.8a DONE** (full admin auth, moderation
  queue/history/approve/reject/revert apply-service, moderation fork in routes,
  seed removal, pg-mem `dev:mock`, client API wrappers + moderation-state load,
  `mutate.js` chokepoint, `overlay.js` optimistic cache + toast + reconcile).
  **83/83 tests green.** Committed 2026-06-07 (see below). **Real production data**
  now in `docs/seed.json` (49 persons/48 rels, gitignored) — pulled from live
  `/api/tree`; `dev-mock.js` seeds all columns.
  **Next = `/as-p5-execute` Phase 2.12** (public History panel) → 2.13 (admin page)
  → 2.14–2.19 (field-visibility / API lockdown serializer) → **2.20** (local
  round-trip test on dev:mock). Proceed one phase per session.
- **Local testing:** `npm run dev:mock` boots the whole app on in-memory pg-mem
  (no Postgres), seeded from `docs/seed.json`. Data resets on restart.
- **Security note (user-flagged):** the public API still returns all person fields;
  the auth-aware serializer that strips hidden fields lands in **2.14–2.17**.
- **Plan now 22 phases** (added 2026-06-07b): **2.8a** = local in-memory DB
  (`pg-mem`) behind `USE_MOCK_DB` + `npm run dev:mock`, sequenced after backend
  (2.1–2.8), before client/admin UI (2.9+); **2.20** = end-of-cycle manual local
  round-trip on the mock DB. See "[AMENDED 2026-06-07b]" in
  `architecture_decisions.md` + `requirements.md`.

### Phase 2 Resume Prompt
> Resuming **Phase 2 — Admin & Moderation + Field Visibility** on the Vanshavali
> tree app. Scope/design/plan approved in `.state/`. Plan is **22 phases
> (2.0–2.20, incl. 2.8a)**. **DONE so far: 2.0–2.11 + 2.8a** (admin auth, moderation
> queue + version history apply-service, route moderation fork, seed removal, pg-mem
> `dev:mock`, client API wrappers, `mutate.js` chokepoint, `overlay.js` optimistic
> overlay). **83/83 tests green; committed.** **NEXT: Phase 2.12** (public History
> panel) via `/as-p5-execute`, then 2.13 (admin page), 2.14–2.19 (field-visibility /
> API lockdown), 2.20 (local round-trip on dev:mock). Read in order: `.state/resume.md`,
> then the Phase 2 + 2026-06-07 sections of `requirements.md`,
> `architecture_decisions.md`, `execution_plan.md`. Local run: `npm run dev:mock`
> (in-memory pg-mem, no Postgres; seeded from real `docs/seed.json`). One phase per
> session, architect approval between each.
>
> **Amendment intent (2.14–2.19):** public site = view + minimal contribute form
> (Name + Gender + Spouse name/gender only; detail fields removed from the public
> DOM and server-whitelisted). Birth year hidden by default with a **global admin
> reveal toggle** (`tree.show_birth_year`). Death year **shows where seeded**, with
> a **per-card admin force-hide** (`person.death_year_hidden` /
> `spouse_death_year_hidden`). Notes admin-only. A single **auth-aware serializer**
> (`src/serializers/person.js`) is the one display control point — the render path
> is untouched and card height is already uniform, so there is **no layout change**.
>
> **Key constraints:** moderation default OFF; birth-year reveal default OFF;
> death-year force-hide default OFF; no visual/presentation/layout changes to the
> tree; all migrations additive+idempotent; soft-hide only (never delete/null data);
> never leak hidden fields to the public (unauthed) API; secrets via env only
> (`JWT_SECRET`); API returns raw objects. Phase 1 is complete and live; `main` has
> unpushed local commits and the `.state/` amendments are **uncommitted** (user
> pushes → Railway auto-deploys).

---

## Phase 1 — COMPLETE (context below)

## Current State

- **Live URL:** https://katari-vanshavali-production.up.railway.app/
- **Branch:** `main` — latest local commit **`697125f`** (Pivot R4). Committed
  locally and **NOT yet pushed** (user pushes + Railway auto-deploys).
- **All phases 0–18 + Pivot R2/R3/R4 + many UI polish rounds complete.**
- `npm test` → **32/32 pass** (3 suites: api, tree-layout, render-smoke).
- **Session open** — awaiting more feedback before closing.

## Pivot R4 — just shipped (feedback 2026-06-02), needs live verify

- **Form reorder:** `Living` checkbox now sits **above** the Birth/Death row
  for **both** the person and the spouse block (consistency fix, commit d543d54).
  New **Sequence** number input
  (`#f-seq`, min 1) below Birth/Death with hint "order among siblings".
- **Sibling ordering:** siblings sort **sequence asc, then birth_year asc**
  (numbered first, unnumbered last, stable = DB order). Centralized in
  `compareSiblings` + `buildAdjacency` (`tree-layout.js`) — the single lever for
  every layout path. `tree-render.js` childrenOf left unsorted (no position impact).
- **Schema:** `person.sequence INTEGER` (nullable); idempotent ALTER added beside
  the R2 columns in `migrate.js`; `requireValidSequence` (int ≥ 1) in persons POST/PATCH.
- **Live-verify TODO (after push/deploy):** enter sequence 1–6 on a sibling set
  (e.g. Vijay→1, RNP→2, Suresh→3, Dharamsheela→4, Dinesh→5, Umesh→6) and confirm
  left-to-right render order; confirm Suresh's children (Col Rajeev, Sanjeev) order
  the same way one level down; confirm Living/Sequence form layout reads well.

## Gathering more feedback (this session)

User is collecting additional feedback before closing. When new items arrive,
treat as **Pivot Round 5**: run `/as-p7-pivot` to append phases, then
`/as-p5-execute` per phase. Keep this section as the scratchpad below.

_Pending feedback — Pivot R5 (2026-06-09), awaiting plan/approval:_
1. **Seed lineage:** add the Katari root chain Titay Singh → Jeevlal Singh →
   Shukan Singh → Gopal Singh → Rameshwar Singh (era 1840–1940).
2. **Year visibility flip:** show **and allow editing** birth+death years for
   **deceased** people; **hide** years for **living** people. (Revisits the
   earlier "death year hidden by default" stance — now keyed off living/deceased.)
3. **Pending-edit diff view:** queued edits in the admin moderation panel should
   render as a readable diff (card / git-diff `from → to`), not raw JSON.
4. **Admin edit-any-card + no-op guard:** admin can edit any card from the panel;
   only enqueue/commit an edit when fields actually changed (no-op edits seen).
5. **Admin-editable lineage line:** the 5-name ancestor line is fully editable from
   the admin panel (add/remove/reorder/edit) + seeded + 1840–1940 caption (Phase 2.26).

**R5 progress (2026-06-09):** plan committed `b88f4ac`. **2.21A + 2.22A + 2.23 DONE**
(life-status year toggles `tree.show_years_deceased` / `tree.show_birth_year_living`
replacing the single `show_birth_year` + per-card hide flags; serializer keyed off
`deceased`/`spouse_deceased`; settings + two admin toggles + route wiring; pending-edit
diff view in the admin queue). **114/114 tests green**; verified on dev:mock. Staged,
**not yet committed** (awaiting architect). **Remaining R5: 2.24** (no-op guard),
**2.25** (admin edit-any-card), **2.26** (admin-editable lineage). 2.20 deferred.
Next: `/as-p5-execute` 2.24 in a fresh session.

## How this app is built (orientation)

Express + PostgreSQL + vanilla-JS SVG frontend. Frontend scripts share global
scope (no bundler); load order in `index.html` matters:
`node-metrics → tree-layout → tree-render → canvas → minimap → transliterate →
sidebar → context-menu → vendor(jspdf,canvg) → export → main`.

Key files:
- `public/js/node-metrics.js` — text measure/wrap + per-card sizing (strict 130px
  width, names wrap; couples = two boxes + COUPLE_GAP).
- `public/js/tree-layout.js` — **Reingold–Tilford** tidy layout: true per-depth
  contours + variable widths (`computeLayout`). One row per generation
  (`colsFor` returns n). `splitTree` peels the ancestor chain above the focal
  ("Bade Lal Singh"). `computeGroupedLayout` is retired from the render path
  (still present/tested).
- `public/js/tree-render.js` — SVG render: couple cards + group container,
  generation **palette by true depth** (`computeDepths` BFS), bands per
  generation, edges via shared bus from the marriage-connector centre, ancestor
  strip + orthogonal dotted connector, per-box edit ✎, add-child +, collapse
  −/+ toggle, chain-highlight on hover (locked), integrated title header.
- `public/js/main.js` — state store, lang toggle, **edit lock** (default ON),
  **search** (bilingual + focus/pulse), title edit (click canvas heading when
  unlocked), help popover, canvas-dismiss, zoom hooks.
- `public/js/canvas.js` — pan/zoom; zoom sizes the SVG element (scroll-accurate);
  default zoom 1.4×; grab/grabbing cursor via `.panning`.
- `public/js/minimap.js` — on by default; clones #tree-svg thumbnail (text
  hidden via CSS), draggable viewport rect.
- `public/js/export.js` — **canvg** raster (full tree, title baked via SVG) +
  self-hosted jsPDF (`public/vendor/`); strips `.affordance`/`.collapse-toggle`;
  minimap is never included (separate element).

## Data model (person)

`name_en/hi, birth_year, death_year, deceased, spouse_en/hi,
spouse_birth_year, spouse_death_year, spouse_deceased, spouse_gender, gender,
notes, x_pos, y_pos`. Couple is derived (spouse name present). Death year hidden
behind the **"Living"** checkbox (checked by default).

## Deploy notes (when pushed)

- `railway.toml` runs `npm run migrate && npm start`. The migration is additive +
  idempotent: adds spouse_*/deceased columns and normalises the title to
  "Katari Lineage" / "वंशावली". No manual DB step.
- Transliteration + Vision need **`ANTHROPIC_API_KEY`** set in Railway. The
  transliterate route now logs clearly and parses fenced JSON (the old 502 cause).

## Latest UI test checklist (after push/deploy)

- [ ] Generation colours follow true depth (a node pushed to a lower row keeps its
      generation colour); RT layout is tight, no overlaps, parents centred
- [ ] One row per generation; narrow boxes wrap; names crisp (15px Noto)
- [ ] Couples: group container, ♂/♀ accent, edit ✎ on BOTH boxes
- [ ] Lock ON by default; locked = view-only + hover chain-highlight; unlock = edit
- [ ] Search finds EN/HI names → centres + pulses; collapse −/+ reflows tree
- [ ] Minimap visible by default, draggable; NOT in exports
- [ ] Export PNG/PDF: full tree, correct integrated title, Devanagari renders
- [ ] Death year hidden unless "Living" unchecked; spouse panel spacing comfortable
- [ ] Transliteration chips match the current name (no stale chips); Enter saves
- [ ] Grab/grabbing pan cursor on canvas

## Memory

Durable prefs saved under `~/.claude/projects/D--CODE-katari-vanshavali/memory/`:
project, plan-first, API-shape, and **feedback_design_palette** (generation
palette + death-year sensitivity).

## Resume Prompt

> Vanshavali family tree — all features in (RT layout, generation palette, lock,
> search, collapsible branches, chain highlight, minimap, robust canvg export,
> Living/Married toggles, **sibling sequence ordering**). 32/32 tests pass. Latest
> commit **697125f** (Pivot R4), committed locally but pending push/deploy.
> **Session left open to gather more feedback** → next round = Pivot R5 via
> `/as-p7-pivot`. Read `.state/resume.md`, then verify the R4 live checklist and
> ensure ANTHROPIC_API_KEY is set on Railway.
