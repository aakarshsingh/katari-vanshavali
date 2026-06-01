# Resume

## Current State

- **Live URL:** https://katari-vanshavali-production.up.railway.app/
- **Branch:** `main` — latest local commit **`4bc277d`**. Several rounds committed
  locally and **NOT yet pushed** (user pushes + Railway auto-deploys).
- **All phases 0–18 + Pivot R2/R3 + many UI polish rounds complete.**
- `npm test` → **26/26 pass** (3 suites: api, tree-layout, render-smoke).

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
> Living/Married toggles). 26/26 tests pass. Latest commit 4bc277d, committed
> locally but pending push/deploy. Read `.state/resume.md`, then verify the live
> UI checklist and ensure ANTHROPIC_API_KEY is set on Railway.
