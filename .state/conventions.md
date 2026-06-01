# Conventions

- **Tone:** Be extremely concise. Lead with answers, not reasoning.

## Project Topography

- **Type:** Standalone frontend-only web app (no backend)
- **Purpose:** Vanshavali (वंशावली) builder — create, edit, and export traditional Indian genealogical trees
- **Reference artifacts:** `docs/sample.png` (Wiki Commons style), `docs/vanshavali.pdf` (grandfather's existing record)
- **Stack:** To be decided in scope — likely HTML/CSS/JS or lightweight framework
- **Output formats:** PNG export, PDF export
- **Languages in UI:** Hindi/Devanagari script support required (Unicode)

## Visual Style

- Traditional, grounded, basic aesthetic — NOT modern/flashy
- Vintage black-and-white with decorative border (as in `docs/sample.png`)
- Top-down tree layout: ancestor at top, descendants below
- Compact node boxes with person name + minimal metadata
- Small info/legend box at bottom (dates, family identifier)

## Naming Conventions

- Files: kebab-case (`family-tree.js`, `export-utils.js`)
- Variables/functions: camelCase
- Components (if framework used): PascalCase

## Patterns & Idioms

- Immutable data: always return new objects, never mutate in place
- Keep files under 400 lines; split by feature
- No deep nesting (>4 levels)
- Validate all user inputs before processing

## Tooling & Commands

- No build system established yet (scope phase will decide)
- Export: browser `canvas` API for PNG; `jsPDF` or `html2canvas` + jsPDF for PDF
- No CI/CD configured

## Field Notes

- Grandfather's existing record is a scanned/basic-tool PDF — the web tool replaces that workflow
- Must support Hindi text input and rendering (font: likely Noto Sans Devanagari or similar)
- Tree data should be serializable (JSON) so sessions can be saved/loaded
- Keep UX minimal — target user is non-technical (grandfather)
