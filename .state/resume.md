# Resume

## Current State

- **Live URL:** https://katari-vanshavali-production.up.railway.app/
- **Last commit:** `f250027` — fix: save error, font sizes, add-node UX, export transform bug
- **Branch:** `main`
- **All phases 0–17 completed.** UI pivot phases 9A–12A, 18 implemented and deployed.

## What Was Done This Session

1. **Deployed to Railway** — fixed DATABASE_URL placeholder issue (Phase 15 ✓)
2. **UI Pivot (phases 9A–18):**
   - `splitTree()` separates ancestor chain from descendants
   - Ancestor strip rendered horizontally above Bade Lal Singh with dotted connector
   - `computeGroupedLayout()` — each son's family = compact group, children wrap in rows of 3, center-aligned
   - Scroll = pan; Ctrl+scroll = zoom; background click no longer adds nodes
   - Page loads centered on Bade Lal Singh
3. **Spouse display** — red 12px labeled `पत्नी:` / `w.`, equal visual weight to name
4. **Hindi fields readonly** — type English, chips auto-fill Hindi
5. **Save bug fixed** — API returns raw objects, sidebar was destructuring `{ person }` (wrong)
6. **Add node UX** — toolbar "+ Add" button + "Add Child" button inside edit sidebar
7. **Export fix** — strip CSS `transform: scale()` from SVG clone before canvas render
8. **Font** — 14px, explicit Noto Devanagari font-family on all SVG text elements

## What Still Needs Testing (next session)

- [ ] Edit a person → save → confirm no error
- [ ] Add a child via sidebar "Add Child" button → confirm appears in tree
- [ ] Add root via toolbar "+ Add" button
- [ ] Hindi transliteration chips appear and fill readonly field
- [ ] Export PNG → downloads and renders correctly
- [ ] Export PDF → A3 landscape, tree visible
- [ ] Lang toggle → tree re-renders in Hindi / English
- [ ] Scroll pans; Ctrl+scroll zooms; zoom buttons work
- [ ] Ancestor strip visible above Bade Lal Singh with dotted line
- [ ] Layout: groups side-by-side, children in wrapped rows

## Known Issues / Things To Watch

- Node text truncated at 22 chars — some long names show `…`. May need widening if user complains.
- `focusPerson('Bade Lal Singh')` — depends on exact `name_en` match in seeded data. If name is slightly different in DB, fallback fires (fit-to-screen). Verify centering works.
- Export: double-draw (250ms delay) needed for Devanagari — works in Chrome, may need testing in Safari.

## Read First On Resume

1. `.state/execution_plan.md` — Phase Summary table (bottom)
2. `.state/conventions.md`

## Resume Prompt

> Vanshavali family tree app — live at https://katari-vanshavali-production.up.railway.app/
> All phases 0–18 implemented and deployed. Resuming UI testing session.
> Read `.state/resume.md` for full context on what was built and what still needs testing.
> Start by asking the user to share a screenshot or describe what they're seeing, then
> work through the testing checklist in resume.md.
