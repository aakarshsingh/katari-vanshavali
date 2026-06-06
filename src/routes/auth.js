const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const { hashPassword, verifyPassword, signToken } = require('../auth/credentials');
const { requireAdmin } = require('../middleware/auth');

const COOKIE_NAME = 'token';
// Shared attributes so clearCookie matches the cookie set at login/setup.
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};
const COOKIE_OPTS = { ...COOKIE_BASE, maxAge: 7 * 24 * 60 * 60 * 1000 };

const MIN_USERNAME = 3;
const MIN_PASSWORD = 8;

function validateCreds(username, password) {
  if (!username || typeof username !== 'string' || username.trim().length < MIN_USERNAME) {
    return `username must be at least ${MIN_USERNAME} characters`;
  }
  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return `password must be at least ${MIN_PASSWORD} characters`;
  }
  return null;
}

async function adminCount() {
  const { rows } = await pool.query('SELECT COUNT(*) FROM admin_user');
  return parseInt(rows[0].count, 10);
}

function issueCookie(res, admin) {
  const token = signToken({ id: admin.id, username: admin.username });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
}

router.get('/status', async (req, res) => {
  try {
    const count = await adminCount();
    res.json({ needsSetup: count === 0, authed: !!req.admin });
  } catch (err) {
    console.error('GET /api/auth/status error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// First-run only: create the first admin while the table is empty. Hard-guarded.
router.post('/setup', async (req, res) => {
  const { username, password } = req.body;
  const invalid = validateCreds(username, password);
  if (invalid) return res.status(400).json({ error: invalid });
  try {
    if ((await adminCount()) > 0) {
      return res.status(409).json({ error: 'Admin already exists' });
    }
    const hash = await hashPassword(password);
    const { rows } = await pool.query(
      'INSERT INTO admin_user (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username.trim(), hash]
    );
    issueCookie(res, rows[0]);
    res.status(201).json({ username: rows[0].username });
  } catch (err) {
    console.error('POST /api/auth/setup error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, username, password_hash FROM admin_user WHERE username = $1',
      [username]
    );
    const admin = rows[0];
    const ok = admin && (await verifyPassword(password, admin.password_hash));
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    issueCookie(res, admin);
    res.json({ username: admin.username });
  } catch (err) {
    console.error('POST /api/auth/login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, COOKIE_BASE);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.admin) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ username: req.admin.username });
});

// Authenticated admins can create additional admins.
router.post('/admins', requireAdmin, async (req, res) => {
  const { username, password } = req.body;
  const invalid = validateCreds(username, password);
  if (invalid) return res.status(400).json({ error: invalid });
  try {
    const existing = await pool.query('SELECT 1 FROM admin_user WHERE username = $1', [username.trim()]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Username already exists' });
    const hash = await hashPassword(password);
    const { rows } = await pool.query(
      'INSERT INTO admin_user (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username.trim(), hash]
    );
    res.status(201).json({ username: rows[0].username });
  } catch (err) {
    console.error('POST /api/auth/admins error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
