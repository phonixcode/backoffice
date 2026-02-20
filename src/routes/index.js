const router  = require('express').Router();

router.get('/', (req, res) => {
  return res.json({
    name:        'BackOffice NG API',
    version:     '1.0.0',
    description: 'A comprehensive company BackOffice management platform for Nigerian businesses',
    status:      'ok',
    contact: {
      support: 'support@backoffice.ng',
      docs:    'https://docs.backoffice.ng'
    },
  });
});

router.get('/health', (req, res) => {
  const memoryUsage   = process.memoryUsage();
  const cpuUsage      = process.cpuUsage();
  const uptimeSeconds = process.uptime();

  const days    = Math.floor(uptimeSeconds / 86400);
  const hours   = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const toMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  const toMS = (us)    => `${(us / 1000).toFixed(2)} ms`;

  return res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),

    uptime: {
      raw:   `${uptimeSeconds.toFixed(0)}s`,
      human: `${days}d ${hours}h ${minutes}m ${seconds}s`
    },

    memory: {
      rss:          toMB(memoryUsage.rss),
      heapTotal:    toMB(memoryUsage.heapTotal),
      heapUsed:     toMB(memoryUsage.heapUsed),
      external:     toMB(memoryUsage.external),
      heapUsagePct: `${((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(1)}%`
    },

    cpu: {
      platform: process.platform,
      arch:     process.arch,
      user:     toMS(cpuUsage.user),
      system:   toMS(cpuUsage.system)
    },

    process: {
      pid:     process.pid,
      version: process.version,
      env:     process.env.NODE_ENV
    }
  });
});

router.use('/api/v1', require('./v1/api'));

module.exports = router;