# वंशावली — Vanshavali

A traditional Indian genealogical tree builder. Create, edit, and export your family tree in both English and Hindi (Devanagari script), with a vintage ink-on-parchment aesthetic inspired by hand-drawn vamshavalis.

## Features

- **Bilingual** — every person stores an English name and a Hindi (Devanagari) name; the canvas *and* the title toggle language live
- **Transliteration chips** — type an English name and get 3–5 AI-generated Devanagari options to click into the Hindi field
- **Couple cards** — tick **Married** in the form to reveal spouse fields; the card then renders as a paired couple (two boxes joined by a marriage connector), each with its own birth/death year. Untick for a single card.
- **Colour coding** — boxes are coloured by **role** (bloodline = cream, married-in spouse = blue-grey) with a small **♂/♀ gender accent** and dark, readable text. Child lines descend from the centre of the marriage connector.
- **SVG tree renderer** — compact top-down grouped layout with **2-row child packing** (fits more per screen); **dynamic node widths + 2-line wrapping** (no truncation); soft generation banding; heavier patriarch border; **Tiro Devanagari Hindi** serif; decorative double border
- **On-card actions** — hover a card for an **edit (✎)** icon and an **add-child (+)** button; right-click for the full menu (add / edit / delete)
- **Pan / zoom / navigate** — scroll to pan, **Ctrl+scroll** (or toolbar buttons) to zoom, Fit to reset, and a toggleable **minimap** for large trees
- **Discoverable controls** — a **?** help button in the toolbar lists every interaction
- **Export** — reliable PNG or PDF (A3 landscape) in either language, rendered with **canvg** so the Devanagari font always embeds correctly. jsPDF and canvg are self-hosted (no CDN dependency)

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | PostgreSQL (via `pg`) |
| AI | Claude API (`@anthropic-ai/sdk`) — transliteration + PDF extraction |
| Frontend | Vanilla JS + SVG (no framework, no bundler) |
| Icons | Lucide (CDN) |
| Export | jsPDF 2.5.1 + canvg 3.0.10 (self-hosted under `public/vendor/`) |
| Fonts | Tiro Devanagari Hindi (tree) + Noto Sans Devanagari — self-hosted woff2 |
| Deploy | Railway |

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally (or a Railway PostgreSQL URL)
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
#   PORT=3000
```

Run migrations (creates `tree`, `person`, `relationship` tables):

```bash
npm run migrate
```

Start the server:

```bash
npm start
# → http://localhost:3000
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

Two test suites: layout algorithm unit tests and API smoke tests (database is mocked — no live DB needed).

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
PORT=3000
```

(`DATABASE_URL` is set automatically by the PostgreSQL plugin.)

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
│   │   ├── migrate.js         # DDL — tree, person, relationship tables
│   │   └── seed.js            # Loads docs/seed.json into PostgreSQL
│   ├── middleware/
│   │   └── validate.js        # Input validation helpers
│   └── routes/
│       ├── tree.js            # GET /api/tree, PATCH /api/tree
│       ├── persons.js         # POST/PATCH/DELETE /api/persons
│       ├── relationships.js   # POST/DELETE /api/relationships
│       └── transliterate.js  # POST /api/transliterate (Claude Haiku)
├── scripts/
│   └── seed-pdf.js            # Claude Vision PDF → seed.json extractor
├── public/
│   ├── index.html
│   ├── css/
│   │   ├── main.css           # Layout, toolbar, SVG node styles
│   │   └── sidebar.css        # Sidebar form, chip styles
│   ├── fonts/                 # Noto Sans Devanagari woff2 (self-hosted)
│   ├── vendor/                # Self-hosted jsPDF + canvg (export libs)
│   └── js/
│       ├── api.js             # Fetch wrappers for all backend routes
│       ├── main.js            # State store, init, lang toggle, title edit, help
│       ├── node-metrics.js    # Text measurement, wrapping, couple card sizing
│       ├── tree-layout.js     # Grouped compact layout (per-node widths)
│       ├── tree-render.js     # SVG renderer (couple cards, edges, bands, border)
│       ├── canvas.js          # Pan / zoom / drag interactions
│       ├── minimap.js         # Toggleable overview + draggable viewport rect
│       ├── transliterate.js   # Chip UI — debounce, cache, chip buttons
│       ├── sidebar.js         # Add / edit person form (parent dropdown, spouse)
│       ├── context-menu.js    # Right-click context menu
│       └── export.js          # PNG and PDF export via canvg
├── tests/
│   ├── tree-layout.test.js    # Layout algorithm unit tests
│   └── api.test.js            # API smoke tests (mocked DB)
├── docs/
│   ├── vanshavali.pdf         # Source family tree (gitignored if private)
│   └── seed.json.example      # Shape reference for seed data
├── .env.example
└── railway.toml               # Railway deploy config
```

## Data Model

```sql
tree         (id, title_en, title_hi, created_at, updated_at)
person       (id, tree_id, name_en, name_hi, birth_year, death_year,
              spouse_en, spouse_hi, spouse_birth_year, spouse_death_year,
              spouse_gender, gender, notes, x_pos, y_pos)
relationship (id, tree_id, parent_id, child_id)
```

All IDs are UUIDs. A single tree row owns all persons and relationships; cascading deletes keep referential integrity.

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
| Edit title | Click the title text in the toolbar |
