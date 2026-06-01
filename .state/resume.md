# Resume

## Current State

- **Live URL:** https://katari-vanshavali-production.up.railway.app/
- **Branch:** `main` — R2 (`3dc88a0`) pushed/deployed; **Round 3 committed locally, pending push**.
- **All phases 0–18 + Pivot R0–R13 + Round 3 T1–T12 complete.** `npm test` → 22/22.

## Round 3 — What Was Built (feedback on deployed R2)

Full plan in `.state/execution_plan.md` → "Pivot Round 3". Locked decisions: role-fill colours,
Tiro Devanagari Hindi font, 2-row child packing.

1. **T1 Colours** — boxes coloured by **role** (bloodline = cream `#fff8f0`, married-in spouse =
   blue-grey `#e6ecf0`) + a ♂/♀ **gender accent** glyph; dark text throughout. Solid red dropped.
   (`tree-render.js` drawBox; CSS node colour rules already removed in R2.)
2. **T2 Font** — self-hosted **Tiro Devanagari Hindi** (`public/fonts/TiroDevanagariHindi-*.woff2`),
   names in regular weight (fixes "lost in bold"). `@font-face` in main.css; `FONT` const in
   tree-render; `node-metrics.M.FONT_NAME/FONT_META`; title CSS; export font.
3. **T3 Married checkbox** — `#f-married` toggles `#spouse-fields`; unchecked → spouse data nulled
   on save (single card). Couple still derived from spouse name. (`index.html`, `sidebar.js`)
4. **T4 Edit parent + re-parent** — edit shows the actual current parent (no more "none"); changing
   it swaps the relationship (delete old + create new). Excludes self + descendants. (`sidebar.js`)
5. **T5 Edge origin** — child lines descend from the **marriage-connector centre** (couples), attach
   to each child's bloodline-box centre. (`tree-render.js` anchors map + renderEdges)
6. **T6 2-row packing** — `colsFor(n)` = ceil(n/2) for families >3 children. (`tree-layout.js`)
7. **T7 Export fix** — canvg `resize(..., 'xMidYMid meet')` + `ignoreDimensions/ignoreClear` (no more
   clipping); **title baked into the image** via canvas fillText with Tiro (Devanagari-safe, fixes
   the `5 6 > 5 2 @` garbage); PDF uses JPEG + ASCII-only footer. (`export.js`)
8. **T8 Banding** — soft low-alpha watermark (`fill-opacity 0.10`, rounded). (`tree-render.js`)
9. **T9 Minimap** — stronger border + drop shadow. (`main.css`)
10. **T10 Title** — empty-state placeholder; edits write the active-language field (EN→title_en).
11. **T11** — README refreshed; layout tests for 2-row packing (22/22).
12. **T12 Density** — smaller cards/min-width, tighter gaps (V_GAP 30, GROUP_GAP 30, H_GAP 14),
    trimmed marriage gap → fits more / less scrolling.

## Known data note

`title_en` in the live DB currently holds Devanagari ("वंशावली") — that's why EN header looked
"broken". Fix is data: open the title in **EN mode** and type an English title; HI mode sets the
Hindi one. Export now bakes whichever title matches the export language and renders it correctly.

## What Still Needs Live Testing (after push/deploy)

- [ ] Colours: cream bloodline / blue-grey spouse + ♂/♀ accent, all readable
- [ ] Tiro font renders Hindi cleanly (not thin/lost)
- [ ] Married checkbox shows/hides spouse fields; unticking removes the spouse box
- [ ] Edit shows real parent; re-parenting moves the subtree; no self/descendant options
- [ ] Child lines start from the = connector centre
- [ ] Families >3 children pack into 2 rows; overall tree noticeably more compact
- [ ] **Export PNG + PDF: full tree (no clipping) + correct title (no garbage)** — the key fix
- [ ] Banding subtle; minimap clearly framed
- [ ] Set an English title in EN mode → header + EN export show it

## Read First On Resume

1. `.state/execution_plan.md` — Pivot Round 3 section
2. `.state/conventions.md`

## Resume Prompt

> Vanshavali — Round 3 implemented locally (role colours + gender accent, Tiro font, married
> checkbox, edit-parent/re-parent, connector-origin edges, 2-row packing, fixed export
> clipping + baked title, density pass). 22/22 tests pass. Committed, pending push/deploy.
> Read `.state/resume.md`, then verify the live UI checklist (esp. export) and have the user
> set an English title in EN mode.
