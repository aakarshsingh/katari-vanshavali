// Diagnostic: inject birth/death years into client state, re-render, and export
// both the tree (PNG) and the flattened review page — to see whether years
// survive the canvg raster in each export path.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const outDir = path.join(__dirname, '..', 'export-smoke-out');

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', String(e)));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('#tree-svg .node').length > 0, { timeout: 20000 });

  // Inject years + Hindi onto every person, mark deceased, then re-render.
  const info = await page.evaluate(() => {
    const s = window.__state;
    const persons = s.persons.map((p, i) => ({
      ...p,
      name_hi: p.name_hi || 'नाम',
      deceased: true,
      birth_year: 1900 + i,
      death_year: 1970 + (i % 20),
      spouse_deceased: !!(p.spouse_en || p.spouse_hi),
      spouse_birth_year: (p.spouse_en || p.spouse_hi) ? 1905 + i : null,
      spouse_death_year: (p.spouse_en || p.spouse_hi) ? 1975 + (i % 20) : null,
      spouse_hi: (p.spouse_en || p.spouse_hi) ? (p.spouse_hi || 'पत्नी') : p.spouse_hi,
    }));
    window.setState({ persons });
    // Count year text nodes actually present in the rendered tree SVG.
    const years = document.querySelectorAll('#tree-svg text.years').length;
    const sample = Array.from(document.querySelectorAll('#tree-svg text.years')).slice(0, 3).map((t) => t.textContent);
    return { years, sample };
  });
  console.log('tree .years text nodes:', info.years, info.sample);

  // Export the tree to PNG and capture it.
  const dl = page.waitForEvent('download', { timeout: 30000 });
  await page.evaluate(() => window.doExport({ format: 'png', lang: 'en' }));
  const download = await dl;
  await download.saveAs(path.join(outDir, 'diag-tree-years.png'));

  // Dump EVERY flattened review page with the injected data, to spot broken names.
  const pageCount = await page.evaluate(async () =>
    (await window.ReviewSections.previewFlattenedPng(window.__state.persons, window.__state.relationships, 'en', 0)).pages);
  for (let i = 0; i < pageCount; i++) {
    const url = await page.evaluate(async (pi) =>
      (await window.ReviewSections.previewFlattenedPng(window.__state.persons, window.__state.relationships, 'en', pi)).dataUrl, i);
    fs.writeFileSync(path.join(outDir, `diag-flat-p${i + 1}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log('flattened pages dumped:', pageCount);

  // Full Review (A4) PDF with the injected years + Hindi, so dates + bilingual show.
  const dl2 = page.waitForEvent('download', { timeout: 60000 });
  await page.evaluate(() => window.doExport({ format: 'review', lang: 'en' }));
  const rev = await dl2;
  await rev.saveAs(path.join(outDir, 'review-sample.pdf'));

  await browser.close();
  console.log('saved diag-tree-years.png + diag-flattened-years.png + review-sample.pdf');
})().catch((e) => { console.error('diag crashed:', e); process.exit(1); });
