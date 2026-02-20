function sanitizeValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // reject objects containing MongoDB operators
    const hasOperator = Object.keys(value).some(k => k.startsWith('$'));
    if (hasOperator) return null;

    // recursively sanitize nested objects
    const sanitized = {};
    for (const [k, v] of Object.entries(value)) {
      sanitized[k.replace(/^\$/, '_')] = sanitizeValue(v);
    }
    return sanitized;
  }

  if (typeof value === 'string') {
    // strip $ from string values
    return value.replace(/\$/g, '');
  }

  return value;
}

const sanitize = (req, res, next) => {
  if (req.body) {
    for (const key of Object.keys(req.body)) {
      req.body[key] = sanitizeValue(req.body[key]);
    }
  }

  if (req.params) {
    for (const key of Object.keys(req.params)) {
      req.params[key] = sanitizeValue(req.params[key]);
    }
  }

  // safely handle query without reassigning the property
  for (const key of Object.keys(req.query)) {
    const sanitized = sanitizeValue(req.query[key]);
    if (sanitized === null) {
      // operator detected in query — reject entire request
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters detected'
      });
    }
  }

  next();
};

module.exports = sanitize;