const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireName(req, res, next) {
  if (!req.body.name_en || typeof req.body.name_en !== 'string' || !req.body.name_en.trim()) {
    return res.status(400).json({ error: 'name_en is required' });
  }
  next();
}

function requireValidYear(field) {
  return (req, res, next) => {
    const val = req.body[field];
    if (val !== undefined && val !== null) {
      const year = parseInt(val, 10);
      if (isNaN(year) || year < 1000 || year > 2100) {
        return res.status(400).json({ error: `${field} must be between 1000 and 2100` });
      }
    }
    next();
  };
}

function requireGender(field) {
  return (req, res, next) => {
    const val = req.body[field];
    if (val !== undefined && val !== null && val !== '') {
      if (!['M', 'F', 'other'].includes(val)) {
        return res.status(400).json({ error: `${field} must be one of M, F, other` });
      }
    }
    next();
  };
}

function requireValidSequence(field) {
  return (req, res, next) => {
    const val = req.body[field];
    if (val !== undefined && val !== null && val !== '') {
      const seq = Number(val);
      if (!Number.isInteger(seq) || seq < 1) {
        return res.status(400).json({ error: `${field} must be an integer >= 1` });
      }
    }
    next();
  };
}

function requireUUID(field) {
  return (req, res, next) => {
    const val = req.params[field] !== undefined ? req.params[field] : req.body[field];
    if (!val || !UUID_RE.test(val)) {
      return res.status(400).json({ error: `${field} must be a valid UUID` });
    }
    next();
  };
}

module.exports = { requireName, requireValidYear, requireUUID, requireGender, requireValidSequence };
