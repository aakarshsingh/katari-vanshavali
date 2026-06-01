const express = require('express');
const path = require('path');
const fs = require('fs');
const { runMigrations } = require('./src/db/migrate');
const { runSeed } = require('./src/db/seed');
const pool = require('./src/db/client');
const treeRouter = require('./src/routes/tree');
const personsRouter = require('./src/routes/persons');
const relationshipsRouter = require('./src/routes/relationships');
const transliterateRouter = require('./src/routes/transliterate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/tree', treeRouter);
app.use('/api/persons', personsRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/transliterate', transliterateRouter);

const SEED_PATH = require('path').join(__dirname, 'docs/seed.json');

async function seedIfEmpty() {
  if (!fs.existsSync(SEED_PATH)) return;
  const { rows } = await pool.query('SELECT COUNT(*) FROM person');
  if (parseInt(rows[0].count, 10) > 0) return;
  console.log('Empty database detected — running auto-seed from docs/seed.json');
  await runSeed();
}

async function start() {
  try {
    await runMigrations();
    await seedIfEmpty();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
