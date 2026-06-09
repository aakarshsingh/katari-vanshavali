# Resume

## ✅ Phase 2 — Admin & Moderation + Field Visibility — SHIPPED (2026-06-09)

The Phase 2 feature cycle is **complete and closed**. Planning docs were archived
(moved, not deleted) to `.state/archive/phase2-admin-moderation/`
(`requirements.md`, `architecture_decisions.md`, `execution_plan.md`).

**Next session starts a fresh campaign** — run `/as-p1-init` → `/as-p2-scope` → … for
new work. `.state/conventions.md` is the durable, repo-wide reference and stays put.

### What shipped in Phase 2
- Admin accounts (first-run signup + add-admin), JWT httpOnly cookie, bcryptjs.
- Moderation toggle (default OFF); single `change_request` table = review queue +
  version history; approve / edit-&-approve / reject / revert.
- `mutate.js` client write chokepoint + `overlay.js` optimistic cache + toast.
- Auth-aware serializer (`src/serializers/person.js`) — the one public-display
  control point; `pickPublicFields` (`src/lib/public-fields.js`) — the one public
  write gate. `notes` always private.
- Life-status year visibility: `tree.show_years_deceased` / `tree.show_birth_year_living`
  (serializer keyed off `deceased` / `spouse_deceased`, person + spouse independent).
- Admin SPA at `/admin.html` (`public/js/admin/`): settings, pending-edit before→after
  diff, applied history with revert, People editor (edit + **delete**, with Hindi
  transliteration chips), and an ancestor-lineage editor (atomic chain reconcile,
  1840–1940 default seed, transliteration chips).
- `npm run dev:mock` boots the whole app on in-memory pg-mem (no Postgres), seeded
  from `docs/seed.json` (gitignored, real data). Data resets on restart.

### R5 / R6 feedback fixes — fast-path, 2026-06-09 (plan 2.27)
1. Admin pending-queue + history rows now label **who** changed (person name).
2. Public history always names the person; **hidden years are stripped from the
   public diff** by the same life-status rule (server-side, `changes.js /applied`).
3. Export PNG/PDF now includes the **1840–1940 ancestor-era caption** (inline SVG
   attrs so canvg renders it without the external stylesheet).
4. When `show_years_deceased` is ON, the **public sidebar exposes the deceased
   year fields** and `pickPublicFields` permits them (person/spouse independent),
   routed through the normal approval path.
5. Transliteration now **preserves an existing Hindi value** (fills only when blank,
   else suggests differing chips) — in both the sidebar and the admin editors.
6. **2.20 cancelled** — verified live on Railway instead of the local mock E2E.

**125/125 tests green** (8 suites). Server-side pieces are unit-tested; the
browser-side items (history labels, export caption, sidebar/admin transliteration,
admin delete) verify on `dev:mock` or Railway.

## How this app is built (orientation)

Express + PostgreSQL + vanilla-JS SVG frontend (no bundler; global-scope scripts,
load order in `index.html` matters). Frontend key files:
- `public/js/node-metrics.js` — text measure/wrap + per-card sizing (130px width).
- `public/js/tree-layout.js` — Reingold–Tilford tidy layout; `splitTree` peels the
  ancestor chain above the focal ("Bade Lal Singh").
- `public/js/tree-render.js` — SVG render: couple cards, generation palette by true
  depth, ancestor strip + **era caption**, edit ✎ / add-child + / collapse toggles.
- `public/js/main.js` — state store, lang toggle, edit lock (default ON), search,
  `loadModerationState()` (sets `window.__moderation` incl. `showYearsDeceased`).
- `public/js/sidebar.js` — two-tier person form (public = name/gender/spouse; admin
  tier + year tier gated by `applyAdminTier()`), no-op guard.
- `public/js/transliterate.js` — EN→HI chips; preserves existing values, optional
  `opts.translit` / `opts.container` (reused by the admin + lineage editors).
- `public/js/export.js` — canvg raster (full tree, title baked) + self-hosted jsPDF.

Server surface: `/api/auth`, `/api/tree`, `/api/persons`, `/api/relationships`,
`/api/changes`, `/api/settings`, `/api/lineage`, `/api/transliterate`
(+ `admin_user`, `change_request` tables).

## Deploy notes

- `railway.toml` runs `npm run migrate && npm start`; the migration is additive +
  idempotent. **User pushes `main` → Railway auto-deploys.**
- Transliteration + Vision need **`ANTHROPIC_API_KEY`** set in Railway.
- Secrets via env only (`JWT_SECRET`, `ANTHROPIC_API_KEY`).

## Memory

Durable prefs under `~/.claude/projects/D--CODE-katari-vanshavali/memory/`:
project, plan-first, API-shape, design-palette, styles-in-CSS, and ship=archive-not-delete.
