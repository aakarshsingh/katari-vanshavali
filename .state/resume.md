# Resume

## Current State

- **Live URL:** https://katari-vanshavali-production.up.railway.app/
- **Branch:** `main` (Pivot Round 2 implemented locally — NOT yet committed/deployed)
- **All phases 0–18 + Pivot R0–R13 complete.** `npm test` → 20/20 pass.

## Pivot Round 2 — What Was Built This Session

Driven by UI feedback. See `.state/execution_plan.md` → "Pivot Round 2" for full per-phase detail.

1. **R0 Schema/API** — `person` gains `spouse_birth_year`, `spouse_death_year`, `spouse_gender`
   (idempotent `ADD COLUMN IF NOT EXISTS` in `migrate.js`; routes + validate updated; sidebar fields added).
2. **R1 Dynamic sizing** — new `public/js/node-metrics.js`: canvas text measurement (Node fallback),
   2-line wrapping, per-node widths, uniform row height. Layout (`tree-layout.js`) now threads a
   `widthOf` map; `tree-render.js` draws per measured width. No more truncation.
3. **R2 Couple cards** — a person renders as a paired couple box (person + spouse + marriage connector)
   **iff** spouse name is filled. Birth/death shown under each name. Spouse box coloured by
   `spouse_gender` (fallback = opposite of person). Dropped the "w./h." prefix entirely.
4. **R3 Compact** — tighter `V_GAP`/`GROUP_GAP`, `MAX_COLS=4`.
5. **R4 Ancestor connector** — orthogonal dotted path (was diagonal).
6. **R5 Generation differentiation** — faint alternating banding + thicker patriarch border.
7. **R6 Title i18n** — header title follows EN/HI; edits write the active-language field.
8. **R7 Card affordances** — hover reveals ✎ (edit) + "+" (add child); class `affordance`, stripped on export.
9. **R8 Parent dropdown** — Add form has a Parent `<select>`; non-empty tree requires a parent.
10. **R9 Export rewrite** — `export.js` uses **canvg** (honors loaded font) + self-hosted
    `public/vendor/jspdf.umd.min.js` & `canvg.umd.js` (no CDN). Re-renders in target lang, restores.
11. **R10 Export popover** — anchored under the Export button (non-modal `dialog.show()` + positioning).
12. **R11 Help** — "?" toolbar button → controls popover.
13. **R12 Minimap** — `public/js/minimap.js`, toggle button, draggable viewport rect (scroll-fraction based).
14. **R13** — README refreshed; layout tests extended (couple/variable-width/no-overlap/uniform-height).

## Important Design Note (answered to user)

Layout is **fully recomputed from state on every change** (`setState → renderTree → widthMap +
computeGroupedLayout` from scratch). Adding/editing a node re-measures and re-lays out the whole
tree, so dynamic additions never break the layout.

## What Still Needs Live Testing (next session)

- [ ] Long names wrap (no `…`); couple boxes render with connector + per-person birth years
- [ ] Spouse colour by gender; husband spouses are not mislabeled (no w./h.)
- [ ] EN mode shows English title; HI shows Hindi
- [ ] Hover card → ✎ + "+"; both work; absent from exported image
- [ ] Add form parent dropdown adds child to chosen parent
- [ ] **Export PNG + PDF actually download and show Devanagari** (canvg) — the key fix
- [ ] Export popover appears under the button; minimap toggles + pans; help button shows controls
- [ ] Generation banding + patriarch border visible and tasteful
- [ ] Deploy: migration adds spouse columns to the live Railway DB (auto via `npm run migrate`)

## Read First On Resume

1. `.state/execution_plan.md` — Phase Summary + Pivot Round 2 details
2. `.state/conventions.md`

## Resume Prompt

> Vanshavali family tree — Pivot Round 2 implemented locally (couple cards, dynamic widths,
> canvg export, minimap, help, parent dropdown, title i18n, generation banding). 20/20 tests pass.
> Not yet committed/deployed. Read `.state/resume.md`, then help verify the live UI testing
> checklist and deploy (migration will add the new spouse columns).
