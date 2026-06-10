// Headless-browser smoke test for the real export path (canvg + jsPDF).
// Boots nothing itself — expects dev:mock already running on PORT (default 3000).
// Drives window.doExport for PNG + PDF(A1/A2/A3), captures the actual download,
// and validates the bytes: no failure alert, valid magic header, and for PDFs
// the page MediaBox orientation + long-side (mm) matches the requested paper.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PT_PER_MM = 72 / 25.4;
const TOL_MM = 3; // jsPDF rounding tolerance

function pdfPageMM(buf) {
  // Find the first /MediaBox [0 0 W H] (points) and convert to mm.
  const m = buf.toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  if (!m) throw new Error('no MediaBox in PDF');
  return { w: +m[1] / PT_PER_MM, h: +m[2] / PT_PER_MM };
}

function pdfPageCount(buf) {
  return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
}

function pngSizePx(buf) {
  if (buf.toString('latin1', 0, 8) !== '\x89PNG\r\n\x1a\n') throw new Error('bad PNG magic');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

(async () => {
  // Stable, gitignored location so artifacts are easy to open after a run.
  const outDir = path.join(__dirname, '..', 'export-smoke-out');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const alerts = [];
  const errors = [];
  page.on('dialog', (d) => { alerts.push(d.message()); d.dismiss().catch(() => {}); });
  page.on('pageerror', (e) => errors.push(String(e)));
  // Ignore the benign 401 auth probe fired on load when not logged in.
  const benign = (t) => /401|Unauthorized/.test(t);
  page.on('console', (m) => { if (m.type() === 'error' && !benign(m.text())) errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  // Wait until the tree has actually rendered nodes.
  await page.waitForFunction(
    () => document.querySelectorAll('#tree-svg .node').length > 0,
    { timeout: 20000 }
  );
  const nodeCount = await page.evaluate(() => document.querySelectorAll('#tree-svg .node').length);
  // Tree aspect ratio from the SVG's own dimensions (drives the zero-waste check).
  const { nodeW, nodeH } = await page.evaluate(() => {
    const svg = document.getElementById('tree-svg');
    return { nodeW: parseFloat(svg.getAttribute('width')), nodeH: parseFloat(svg.getAttribute('height')) };
  });

  const cases = [
    { name: 'png', opts: { format: 'png', lang: 'en' } },
    { name: 'pdf-a1-land', opts: { format: 'pdf', lang: 'en', paper: 'a1', orient: 'landscape' }, longMM: 841 },
    { name: 'pdf-a2-land', opts: { format: 'pdf', lang: 'en', paper: 'a2', orient: 'landscape' }, longMM: 594 },
    { name: 'pdf-a3-land', opts: { format: 'pdf', lang: 'hi', paper: 'a3', orient: 'landscape' }, longMM: 420 },
    { name: 'pdf-a1-port', opts: { format: 'pdf', lang: 'en', paper: 'a1', orient: 'portrait' }, longMM: 841 },
    { name: 'pdf-a2-port', opts: { format: 'pdf', lang: 'en', paper: 'a2', orient: 'portrait' }, longMM: 594 },
    { name: 'pdf-a3-port', opts: { format: 'pdf', lang: 'hi', paper: 'a3', orient: 'portrait' }, longMM: 420 },
    { name: 'review', opts: { format: 'review', lang: 'en' }, review: true },
  ];

  const results = [];
  for (const c of cases) {
    const before = alerts.length;
    const dl = page.waitForEvent('download', { timeout: 30000 });
    await page.evaluate((opts) => window.doExport(opts), c.opts);
    let file;
    try {
      const download = await dl;
      file = path.join(outDir, c.name + (c.opts.format === 'png' ? '.png' : '.pdf'));
      await download.saveAs(file);
    } catch (e) {
      results.push({ case: c.name, ok: false, detail: 'no download: ' + e.message });
      continue;
    }
    if (alerts.length > before) {
      results.push({ case: c.name, ok: false, detail: 'alert: ' + alerts[alerts.length - 1] });
      continue;
    }
    const buf = fs.readFileSync(file);
    try {
      if (c.opts.format === 'png') {
        const { w, h } = pngSizePx(buf);
        results.push({ case: c.name, ok: w > 0 && h > 0, detail: `${buf.length}B, ${w}x${h}px` });
      } else if (c.review) {
        const { w: pw, h: ph } = pdfPageMM(buf); // first page = landscape A4 tree tile
        const pages = pdfPageCount(buf);
        const raw = buf.toString('latin1');
        const lossless = raw.includes('/FlateDecode') && !raw.includes('/DCTDecode');
        const a4Land = Math.abs(Math.max(pw, ph) - 297) <= TOL_MM && Math.abs(Math.min(pw, ph) - 210) <= TOL_MM;
        results.push({
          case: c.name,
          ok: buf.length > 1000 && pages >= 3 && lossless && a4Land,
          detail: `${(buf.length / 1024).toFixed(0)}KB, ${pages} pages, first ${pw.toFixed(0)}x${ph.toFixed(0)}mm `
            + `${a4Land ? 'A4-land' : '!A4'}, ${lossless ? 'PNG' : 'JPEG!'}`,
        });
      } else {
        const { w: pw, h: ph } = pdfPageMM(buf);
        const long = Math.max(pw, ph), short = Math.min(pw, ph);
        const longOk = Math.abs(long - c.longMM) <= TOL_MM;
        // The displayed tree aspect flips when rotated for the portrait option.
        const rotate = c.opts.orient === 'portrait';
        const dispAspect = rotate ? (nodeH / nodeW) : (nodeW / nodeH);
        // Zero-waste check: draw area (page minus 8mm margins + 8mm footer) must
        // match the displayed aspect, i.e. the image fills it with no slack.
        const M = 8, F = 8;
        const drawAspect = (pw - M * 2) / (ph - M - F);
        const fillOk = Math.abs(drawAspect - dispAspect) / dispAspect < 0.02;
        // Orientation must follow the request.
        const orientOk = rotate ? (ph > pw) : (pw > ph);
        // Crispness: image must be lossless PNG (FlateDecode), not JPEG (DCTDecode).
        const raw = buf.toString('latin1');
        const lossless = raw.includes('/FlateDecode') && !raw.includes('/DCTDecode');
        results.push({
          case: c.name,
          ok: buf.length > 1000 && longOk && fillOk && orientOk && lossless,
          detail: `${(buf.length / 1024).toFixed(0)}KB, page ${pw.toFixed(0)}x${ph.toFixed(0)}mm `
            + `(long ${long.toFixed(0)} want ${c.longMM}±${TOL_MM}), `
            + `${pw >= ph ? 'landscape' : 'portrait'}${orientOk ? '' : '!ORIENT'}, `
            + `fill ${fillOk ? 'OK' : 'WASTE'}, ${lossless ? 'PNG' : 'JPEG!'}`,
        });
      }
    } catch (e) {
      results.push({ case: c.name, ok: false, detail: 'parse: ' + e.message });
    }
  }

  // Visual preview: render page 1 AND a continuation page of the flattened-card
  // section so the look & feel + pagination (no overflow) can be eyeballed.
  const flat = await page.evaluate(async () => {
    const p0 = await window.ReviewSections.previewFlattenedPng(window.__state.persons, window.__state.relationships, 'en', 0);
    const p1 = await window.ReviewSections.previewFlattenedPng(window.__state.persons, window.__state.relationships, 'en', 1);
    return { p0: p0.dataUrl, p1: p1.dataUrl, pages: p0.pages };
  });
  fs.writeFileSync(path.join(outDir, 'preview-flattened-p1.png'), Buffer.from(flat.p0.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(outDir, 'preview-flattened-p2.png'), Buffer.from(flat.p1.split(',')[1], 'base64'));
  console.log(`\nFlattened section: ${flat.pages} pages`);

  await browser.close();

  console.log(`\nTree rendered: ${nodeCount} node groups`);
  console.log('Page errors:', errors.length ? errors : 'none');
  console.log('\nExport results:');
  let allOk = true;
  for (const r of results) {
    allOk = allOk && r.ok;
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.case.padEnd(8)}  ${r.detail}`);
  }
  console.log('\nArtifacts:', outDir);
  console.log(allOk && errors.length === 0 ? '\nALL EXPORT CHECKS PASSED' : '\nEXPORT CHECKS FAILED');
  process.exit(allOk && errors.length === 0 ? 0 : 1);
})().catch((e) => { console.error('smoke crashed:', e); process.exit(2); });
