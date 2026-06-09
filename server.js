require('dotenv').config({ quiet: true }); // load .env into process.env (no-op if absent)
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { runMigrations } = require('./src/db/migrate');
const { attachAdmin } = require('./src/middleware/auth');
const authRouter = require('./src/routes/auth');
const settingsRouter = require('./src/routes/settings');
const changesRouter = require('./src/routes/changes');
const treeRouter = require('./src/routes/tree');
const personsRouter = require('./src/routes/persons');
const relationshipsRouter = require('./src/routes/relationships');
const lineageRouter = require('./src/routes/lineage');
const transliterateRouter = require('./src/routes/transliterate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(attachAdmin); // sets req.admin (or null) for every request before routers
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/changes', changesRouter);
app.use('/api/tree', treeRouter);
app.use('/api/persons', personsRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/lineage', lineageRouter);
app.use('/api/transliterate', transliterateRouter);

async function start() {
  try {
    await runMigrations();
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
