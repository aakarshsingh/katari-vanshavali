# वंशावली — Vanshavali

A traditional Indian genealogical tree builder. Create, edit, and export your family tree in both English and Hindi (Devanagari script), with a vintage ink-on-parchment aesthetic inspired by hand-drawn vamshavalis.

## Features

- **Bilingual** — every person stores an English name and a Hindi (Devanagari) name; the canvas *and* the title toggle language live
- **Transliteration chips** — type an English name and get 3–5 AI-generated Devanagari options to click into the Hindi field
- **Couple cards** — tick **Married** in the form to reveal spouse fields; the card then renders as a paired couple (two boxes joined by a marriage connector), each with its own birth/death year. Untick for a single card.
- **Generation colour palette** — bloodline boxes are coloured **by generation** in muted Indian natural-dye tones (Kumkum red → turmeric → mehendi → indigo → terracotta) with thick coloured borders so the bloodline pops; married-in spouses are a uniform muted taupe. Gender is shown by a small **♂/♀ accent**. Sepia ink on a parchment canvas.
- **Clean line routing** — children hang from a shared horizontal bus just below each parent; child lines descend from the centre of the marriage connector. Larger families pack into two rows with the second row brick-offset so its lines pass between (not through) the first row.
- **Edit lock** — a lock toggle (ON by default) keeps the tree read-only for safe viewing; unlock to enable editing. Navigation, export, language and minimap stay available while locked.
- **Search** — bilingual (English/Hindi) toolbar search; pick a result to smoothly centre and pulse-highlight that person.
- **Minimap** — on by default (a wide tree needs it); draggable viewport box; click/drag to pan.
- **Collapsible branches** — a −/+ toggle on every parent collapses or expands its descendants (the tree reflows via the RT layout).
- **Chain highlight** — in locked/view mode, hovering a card lights up its lineage up to the root; in unlocked mode hover shows the edit/add affordances instead.
- **Couples** — each box (person *and* spouse) has its own edit icon; the pair sits in a subtle group container.
- **SVG tree renderer** — compact top-down grouped layout with **2-row child packing** (fits more per screen); **dynamic node widths + 2-line wrapping** (no truncation); soft generation banding; heavier patriarch border; **Tiro Devanagari Hindi** serif; decorative double border
- **On-card actions** — hover a card for an **edit (✎)** icon and an **add-child (+)** button; right-click for the full menu (add / edit / delete)
- **Pan / zoom / navigate** — scroll to pan, **Ctrl+scroll** (or toolbar buttons) to zoom, Fit to reset, and a toggleable **minimap** for large trees
- **Discoverable controls** — a **?** help button in the toolbar lists every interaction
- **Export** — reliable PNG or PDF (A3 landscape) in either language, rendered with **canvg** so the Devanagari font always embeds correctly. jsPDF and canvg are self-hosted (no CDN dependency)
- **Ancestor lineage strip** — the single-child chain above the focal ancestor ("Bade Lal Singh") renders as a compact horizontal strip with an **era caption** ("1840 – 1940") and a dotted connector down to the focal.

### Admin & moderation

An unlinked admin console at **`/admin`** (its own page; not referenced from the public site) gates and curates edits. Auth is a JWT in an httpOnly cookie (bcrypt-hashed passwords).

- **First-run signup → login** — the first visit creates the initial admin; add more admins from the dashboard.
- **Moderation toggle** (default **OFF**) — when ON, anonymous public edits are queued for review instead of applied; contributors keep an optimistic localStorage overlay of their own pending edits until an admin resolves them.
- **Pending queue** — approve, edit-then-approve, or reject. Person edits render as a readable **before → after diff**, not raw JSON.
- **History + revert** — applied/reverted changes are listed (anonymised in the public history panel); an admin can revert any applied change (logs the inverse).
- **Field visibility** — two life-status toggles control what the **public** API exposes: *show years for deceased people* and *show birth year for living people* (both default OFF). `notes` is always admin-only. A single auth-aware serializer (`src/serializers/person.js`) is the one display chokepoint, so the public/unauthenticated API never leaks hidden fields.
- **Two-tier contribute form** — the public form is reduced to name + gender + spouse name/gender (detail fields are removed from the DOM and whitelisted server-side); admins get the full field set.
- **People editor** — edit any person directly from the admin panel.
- **Editable ancestor lineage** — add/remove/reorder/edit the ancestor chain from the admin panel; the chain is reconciled atomically server-side (`/api/lineage`), preserving the single parent→child path to the focal. A "Load 1840–1940 default" button seeds the suggested chain.
- **No-op guard** — re-saving an unchanged card never enqueues or commits (enforced server-side); edits write only the fields that actually changed.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | PostgreSQL (via `pg`); `pg-mem` for the local in-memory dev DB |
| Auth | `jsonwebtoken` (httpOnly cookie via `cookie-parser`) + `bcryptjs` |
| AI | Claude API (`@anthropic-ai/sdk`) — transliteration + PDF extraction |
| Frontend | Vanilla JS + SVG (no framework, no bundler) |
| Icons | Lucide (CDN) |
| Export | jsPDF 2.5.1 + canvg 3.0.10 (self-hosted under `public/vendor/`) |
| Fonts | Tiro Devanagari Hindi (tree) + Noto Sans Devanagari — self-hosted woff2 |
| Deploy | Railway |

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally (or a Railway PostgreSQL URL) — **not needed for `npm run dev:mock`**
- An Anthropic API key (for transliteration and PDF seeding)

### Setup

```bash
git clone https://github.com/aakarshsingh/katari-vanshavali.git
cd katari-vanshavali
npm install
```

Copy the example env file and fill in your values:

```bash
cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgresql://user:pass@localhost:5432/vanshavali
#   ANTHROPIC_API_KEY=sk-ant-...
#   JWT_SECRET=<a long random string>   # signs admin session cookies
#   PORT=3000
```

Run migrations (creates `tree`, `person`, `relationship`, `admin_user`, `change_request` tables; all migrations are additive + idempotent):

```bash
npm run migrate
```

Start the server:

```bash
npm start
# → http://localhost:3000
# admin console at http://localhost:3000/admin
```

### Run without Postgres (in-memory)

For quick local work there is an in-memory database (`pg-mem`) seeded from `docs/seed.json`. No Postgres, no migration step — data resets on each restart:

```bash
npm run dev:mock
# → http://localhost:3000 (in-memory DB)
```

### Seeding from the family PDF

If you have a scanned family tree PDF at `docs/vanshavali.pdf`, extract it with Claude Vision and load it into the database:

```bash
npm run seed:pdf   # reads docs/vanshavali.pdf → writes docs/seed.json
npm run seed       # inserts seed.json into PostgreSQL
```

`docs/seed.json` is committed and used for auto-seeding on first boot. `docs/seed.json.example` shows the expected shape if you want to replace it with your own data.

### Tests

```bash
npm test
```

The database is mocked, so no live DB is needed. Suites cover the layout algorithm, SVG render smoke, the API, auth, persons (incl. the no-op guard + field whitelist), the moderation queue/changes, the auth-aware serializer matrix, and the ancestor-chain walk.

## Deploying to Railway

### 1. Create the project

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select `aakarshsingh/katari-vanshavali`
3. Railway detects Node.js automatically; `railway.toml` sets the start command

### 2. Add PostgreSQL

In the Railway project dashboard: **+ New** → **Database** → **PostgreSQL**

Railway injects `DATABASE_URL` into the service automatically.

### 3. Set environment variables

In the service **Variables** tab:

```
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=<a long random string>
PORT=3000
```

(`DATABASE_URL` is set automatically by the PostgreSQL plugin.) `JWT_SECRET` must be set for admin sessions to survive restarts — without it the server falls back to a random per-boot secret and logs out admins on every deploy.

### 4. Deploy

Click **Deploy**. The start command runs `npm run migrate && npm start`. On first boot the server auto-seeds the database from `docs/seed.json` if the database is empty — no manual shell step needed. The health check at `/health` must return 200 for the deploy to be marked healthy.

### 5. Verify

```bash
curl https://<your-railway-url>/health
# → {"status":"ok"}

curl https://<your-railway-url>/api/tree
# → {"tree":{...},"persons":[...],"relationships":[...]}
```

Visit the app URL in a browser — the family tree should render immediately.

## Project Structure

```
├── server.js                  # Express entry point; mounts all routes
├── src/
│   ├── db/
│   │   ├── client.js          # pg.Pool instance
│   │   └── migrate.js         # DDL — tree, person, relationship, admin_user, change_request
│   ├── auth/
│   │   └── credentials.js     # bcrypt hashing + JWT sign/verify
│   ├── middleware/
│   │   ├── validate.js        # Input validation helpers
│   │   └── auth.js            # attachAdmin (req.admin) + requireAdmin gate
│   ├── lib/
│   │   └── public-fields.js   # Whitelist for non-admin writes
│   ├── serializers/
│   │   └── person.js          # Auth-aware field visibility (the display chokepoint)
│   ├── services/
│   │   ├── mutations.js       # applyChange + withTransaction (the single writer)
│   │   └── changelog.js       # Pending / applied change_request records + summary
│   └── routes/
│       ├── auth.js            # /api/auth — setup, login, logout, me, admins
│       ├── settings.js        # GET/PATCH /api/settings (moderation + year toggles)
│       ├── changes.js         # /api/changes — submit, queue, approve, reject, revert
│       ├── tree.js            # GET /api/tree, PATCH /api/tree
│       ├── persons.js         # POST/PATCH/DELETE /api/persons (no-op guarded)
│       ├── relationships.js   # POST/DELETE /api/relationships
│       ├── lineage.js         # GET/PUT /api/lineage (atomic ancestor-chain reconcile)
│       └── transliterate.js  # POST /api/transliterate (Claude Haiku)
├── scripts/
│   ├── seed-pdf.js            # Claude Vision PDF → seed.json extractor
│   └── dev-mock.js            # In-memory pg-mem server (npm run dev:mock)
├── public/
│   ├── index.html
│   ├── admin.html             # Unlinked admin console (SPA shell)
│   ├── css/
│   │   ├── main.css           # Layout, toolbar, SVG node styles, era caption
│   │   ├── sidebar.css        # Sidebar form, chip styles
│   │   └── admin.css          # Admin console styling
│   ├── fonts/                 # Noto Sans Devanagari woff2 (self-hosted)
│   ├── vendor/                # Self-hosted jsPDF + canvg (export libs)
│   └── js/
│       ├── api.js             # Fetch wrappers for all backend routes
│       ├── mutate.js          # Edit chokepoint — direct vs moderation-queue routing
│       ├── overlay.js         # Optimistic localStorage overlay + toast (pending edits)
│       ├── main.js            # State store, init, lang toggle, title edit, help
│       ├── node-metrics.js    # Text measurement, wrapping, couple card sizing
│       ├── tree-layout.js     # Grouped compact layout + splitTree (ancestor chain)
│       ├── tree-render.js     # SVG renderer (couple cards, edges, bands, ancestor strip)
│       ├── canvas.js          # Pan / zoom / drag interactions
│       ├── minimap.js         # Toggleable overview + draggable viewport rect
│       ├── transliterate.js   # Chip UI — debounce, cache, chip buttons
│       ├── sidebar.js         # Add / edit person form (parent dropdown, spouse)
│       ├── context-menu.js    # Right-click context menu
│       ├── export.js          # PNG and PDF export via canvg
│       └── admin/
│           ├── admin-api.js   # Fetch client for the admin console
│           └── admin-app.js   # Admin SPA — settings, queue, history, people, lineage
├── tests/                     # Jest suites: layout, render-smoke, api, auth,
│                              #   persons, changes, serializer, lineage (mocked DB)
├── docs/
│   ├── vanshavali.pdf         # Source family tree (gitignored if private)
│   └── seed.json.example      # Shape reference for seed data
├── .env.example
└── railway.toml               # Railway deploy config
```

## Data Model

```sql
tree         (id, title_en, title_hi, created_at, updated_at,
              moderation_enabled, show_years_deceased, show_birth_year_living)
person       (id, tree_id, name_en, name_hi, birth_year, death_year, deceased,
              spouse_en, spouse_hi, spouse_birth_year, spouse_death_year,
              spouse_deceased, spouse_gender, gender, notes, sequence, x_pos, y_pos)
relationship (id, tree_id, parent_id, child_id)
admin_user   (id, username, password_hash, created_at)
change_request (id, tree_id, op_type, entity, target_id, payload,
                before_snapshot, after_snapshot, status, client_token,
                submitter_note, submitted_at, resolved_by, resolved_at)
```

All IDs are UUIDs. A single tree row owns all persons and relationships; cascading deletes keep referential integrity. `change_request` is both the moderation queue (`status='pending'`) and the version-history log (`applied`/`reverted`/`rejected`). The `tree` flags drive moderation and public field visibility; `sequence` orders siblings. Migrations are additive and idempotent (safe to run repeatedly).

## Usage

| Action | How |
|--------|-----|
| Add anyone | **Add** button in toolbar → pick a parent from the dropdown (or *none* for a root) |
| Add child quickly | Hover a card → **+**, or right-click → Add Child |
| Make a couple | Edit a person → tick **Married** → fill the spouse name (+ optional birth/death/gender) |
| Edit person | Click a card, hover → **✎**, or right-click → Edit |
| Re-parent / set parent | Edit a person → change the **Parent** dropdown (shows current parent; excludes self & descendants) |
| Delete person | Right-click → Delete (confirmed) |
| Switch language | EN / HI toggle in toolbar (canvas + title) |
| Export | Export button (opens a popover beside it) → PNG or PDF + language |
| Pan | Scroll, or drag on empty canvas |
| Zoom | **Ctrl + scroll**, or toolbar zoom buttons; Fit to reset |
| Minimap | Toggle the map button in the toolbar |
| See all controls | **?** help button in the toolbar |
| Find a person | Type in the toolbar **search** (English or Hindi) → click a result |
| Collapse / expand a branch | Click the **−/+** toggle at a parent's bottom edge |
| Trace a lineage | Hover a card while **locked** — the chain to the root highlights |
| Lock / unlock editing | Lock toggle in the toolbar (locked by default; unlock to edit) |
| Close the form | Click any empty area of the canvas |
| Record a death year | Untick **Living** in the form (checked by default, so death year stays hidden) |
| Edit title | Unlock, then click the title heading on the canvas |

### Admin console (`/admin`)

| Action | How |
|--------|-----|
| First-time setup | Visit `/admin` → create the initial admin account |
| Require approval for public edits | **Settings** → toggle *Require approval* (moderation; default OFF) |
| Reveal years publicly | **Settings** → *Show years for deceased* and/or *Show birth year for living* (both default OFF) |
| Review a queued edit | **Pending edits** → read the before→after diff → Approve / Edit & approve / Reject |
| Undo an applied change | **History** → Revert |
| Edit any person | **People** → filter → Edit → Save |
| Edit the ancestor line | **Ancestor lineage** → edit/reorder/add/remove rows (or *Load 1840–1940 default*) → Save lineage |
| Add another admin | **Add admin** form on the dashboard |
