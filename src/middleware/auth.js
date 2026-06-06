const { verifyToken } = require('../auth/credentials');

// Reads the JWT cookie and attaches `req.admin = {id, username}` when valid,
// or `null` otherwise. Never throws — runs on every request (incl. public).
function attachAdmin(req, res, next) {
  req.admin = null;
  const token = req.cookies && req.cookies.token;
  if (token) {
    const payload = verifyToken(token);
    if (payload && payload.id) {
      req.admin = { id: payload.id, username: payload.username };
    }
  }
  next();
}

// Gate admin-only routes. Returns 401 raw `{error}` when no valid admin.
function requireAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  next();
}

module.exports = { attachAdmin, requireAdmin };
