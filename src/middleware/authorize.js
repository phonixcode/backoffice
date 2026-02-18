const apiResponse = require('../utils/apiResponse');

const METHOD_ACTION_MAP = {
  POST:   'create',
  GET:    'read',
  PUT:    'update',
  PATCH:  'update',
  DELETE: 'delete'
};

// usage:
// authorize()                    → derives resource + action from request automatically
// authorize('approve')           → custom action, resource still derived from URL
// authorize('payroll', 'process') → explicit resource + custom action
const authorize = (resourceOrAction = null, customAction = null) => {
  return (req, res, next) => {
    if (!req.user) {
      return apiResponse.error(res, 'Unauthenticated', 401);
    }

    let resourceName;
    let action;

    if (resourceOrAction && customAction) {
      // both explicitly provided
      resourceName = resourceOrAction;
      action = customAction;
    } else if (resourceOrAction) {
      // only one arg — treat as custom action, derive resource from URL
      const parts = req.baseUrl.split('/').filter(Boolean);
      resourceName = parts[parts.length - 1];
      action = resourceOrAction;
    } else {
      // nothing provided — derive everything from request
      const parts = req.baseUrl.split('/').filter(Boolean);
      resourceName = parts[parts.length - 1];
      action = METHOD_ACTION_MAP[req.method];
    }

    if (!resourceName || !action) {
      return apiResponse.error(res, 'Cannot determine resource or action', 400);
    }

    const requiredPermission = `${resourceName}:${action}`;
    const hasAccess = req.user.permissionsCache.includes(requiredPermission);

    if (!hasAccess) {
      return apiResponse.error(
        res,
        `Access denied — you need "${requiredPermission}" permission`,
        403
      );
    }

    next();
  };
};

module.exports = authorize;