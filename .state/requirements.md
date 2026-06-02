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
  id            UUID PK
  title_en      TEXT
  title_hi      TEXT
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ

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
  notes         TEXT
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
