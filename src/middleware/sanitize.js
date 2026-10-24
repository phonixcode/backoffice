// Reject unsafe field names without changing user data (including passwords).
// This is defense in depth; each endpoint still needs a strict input schema.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function hasUnsafeKeys(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) =>
    key.startsWith('$') || key.includes('.') || UNSAFE_KEYS.has(key)
    || hasUnsafeKeys(child)
  );
}

module.exports = (req, res, next) => {
  if ([req.body, req.params, req.query].some(hasUnsafeKeys)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input field names detected'
    });
  }
  next();
};
