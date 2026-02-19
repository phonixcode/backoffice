const responseTime = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6; // convert to ms
    const color    = duration > 500 ? '🔴' : duration > 200 ? '🟡' : '🟢';
    console.log(`${color} ${req.method} ${req.originalUrl} — ${duration.toFixed(2)}ms [${res.statusCode}]`);
  });

  next();
};

module.exports = responseTime;