const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ success: false, message: 'Validation Error', errors });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Record';
    return res.status(409).json({ success: false, message: `${field} already exists` });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid resource identifier' });
  }

  const candidate = err.statusCode || err.status;
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599
    ? candidate : 500;
  const production = process.env.NODE_ENV === 'production';
  return res.status(status).json({
    success: false,
    message: production && status >= 500
      ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
    ...((process.env.NODE_ENV || 'development') === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
