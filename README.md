# वंशावली — Vanshavali

A traditional Indian genealogical tree builder. Create, edit, and export your family tree in both English and Hindi (Devanagari script), with a vintage ink-on-parchment aesthetic inspired by hand-drawn vamshavalis.

## Features

- **Bilingual** — every person stores an English name and a Hindi (Devanagari) name; toggle the display language live
- **Transliteration chips** — type an English name and get 3–5 AI-generated Devanagari options to click into the Hindi field
- **SVG tree renderer** — top-down Reingold-Tilford layout; decorative double border; colour-coded nodes (cream for male, deep red for female)
- **Pan / zoom** — drag to pan, scroll-wheel or toolbar buttons to zoom, Fit button to reset
- **Full CRUD** — right-click any node to add a child, edit, or delete; background click to add a root ancestor
- **Export** — PNG (2× pixel ratio, crisp) or PDF (A3 landscape, title block, info line) in either language

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | PostgreSQL (via `pg`) |
| AI | Claude API (`@anthropic-ai/sdk`) — transliteration + PDF extraction |
| Frontend | Vanilla JS + SVG (no framework, no bundler) |
| Icons | Lucide (CDN) |
| PDF export | jsPDF 2.5.1 (CDN) |
| Fonts | Noto Sans Devanagari (self-hosted woff2) |
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
│   └── js/
│       ├── api.js             # Fetch wrappers for all backend routes
│       ├── main.js            # State store, init, lang toggle, title edit
│       ├── tree-layout.js     # Reingold-Tilford layout algorithm
│       ├── tree-render.js     # SVG renderer (nodes, edges, border)
│       ├── canvas.js          # Pan / zoom / drag interactions
│       ├── transliterate.js   # Chip UI — debounce, cache, chip buttons
│       ├── sidebar.js         # Add / edit person form
│       ├── context-menu.js    # Right-click context menu
│       └── export.js          # PNG and PDF export
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
              spouse_en, spouse_hi, gender, notes, x_pos, y_pos)
relationship (id, tree_id, parent_id, child_id)
```

All IDs are UUIDs. A single tree row owns all persons and relationships; cascading deletes keep referential integrity.

## Usage

| Action | How |
|--------|-----|
| Add root ancestor | Click empty canvas area |
| Add child | Right-click a node → Add Child |
| Edit person | Right-click → Edit, or click the node |
| Delete person | Right-click → Delete (confirmed) |
| Switch language | EN / HI toggle in toolbar |
| Export | Export button → choose PNG or PDF + language |
| Zoom | Toolbar buttons or scroll wheel |
| Pan | Drag on empty canvas |
| Edit title | Click the title text in the toolbar |
