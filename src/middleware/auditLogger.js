const auditService = require('../modules/audit/audit.service');
const { UAParser } = require('ua-parser-js');
const geoip = require('geoip-lite');

const AUDITED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE', 'GET'];
const EXCLUDED_RESOURCES = ['auth'];

function parseDevice(req) {
  const ua = req.headers['user-agent'] || '';
  const parser = new UAParser(ua);
  const result = parser.getResult();

  return {
    userAgent: ua,
    browser: {
      name:    result.browser.name    || 'unknown',
      version: result.browser.version || 'unknown'
    },
    os: {
      name:    result.os.name    || 'unknown',
      version: result.os.version || 'unknown'
    },
    device: {
      type:   result.device.type   || 'desktop',
      vendor: result.device.vendor || 'unknown',
      model:  result.device.model  || 'unknown'
    }
  };
}

function parseLocation(req) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.ip;

  const cleanIp = ip === '::1' ? '127.0.0.1' : ip;
  const geo = geoip.lookup(cleanIp);

  return {
    ip:       cleanIp,
    country:  geo?.country  || 'unknown',
    region:   geo?.region   || 'unknown',
    city:     geo?.city     || 'unknown',
    timezone: geo?.timezone || 'unknown',
    ll:       geo?.ll       || []
  };
}

function getAction(method, path) {
  const customActions = ['approve', 'reject', 'terminate', 'process', 'cancel', 'mark-paid'];
  const matchedAction = customActions.find(a => path.includes(a));
  if (matchedAction) return matchedAction;

  const map = {
    POST:   'create',
    PUT:    'update',
    PATCH:  'update',
    DELETE: 'delete',
    GET:    'read'
  };
  return map[method] || method.toLowerCase();
}

function getStatus(statusCode) {
  if (statusCode === 403) return 'forbidden';
  if (statusCode >= 400) return 'failed';
  return 'success';
}

const auditLogger = (req, res, next) => {
  const resource = req.baseUrl.split('/').filter(Boolean).pop();

  if (EXCLUDED_RESOURCES.includes(resource)) {
    return next();
  }

  const device   = parseDevice(req);
  const location = parseLocation(req);

  // track response data
  let statusCode = 200;
  let responseBody = null;

  // intercept res.status to capture status code
  const originalStatus = res.status.bind(res);
  res.status = function (code) {
    statusCode = code;
    return originalStatus(code);
  };

  // intercept res.json to capture body and trigger log
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    responseBody = data;

    // fire and forget — never block the response
    setImmediate(() => {
      auditService.log({
        performedBy: req.user || null,
        action:      req.method,
        resource,
        permission:  `${resource}:${getAction(req.method, req.path)}`,
        request:     req,
        response: {
          statusCode,
          success: data?.success ?? false
        },
        status:   getStatus(statusCode),
        device,
        location
      }).catch(err => console.error('Audit log failed:', err.message));
    });

    return originalJson(data);
  };

  next();
};

module.exports = auditLogger;