const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

// JWT secret from env. If unset, generate a random per-boot secret so the admin
// area still works in a degraded mode (sessions won't survive a restart).
// The secret value itself is never logged.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn(
    '[auth] JWT_SECRET not set — using a random per-boot secret; ' +
    'admin sessions will not survive a restart.'
  );
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// Returns the decoded payload, or null for any invalid/expired/garbage token.
// Never throws — callers (middleware) rely on this.
function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
