const router     = require('express').Router();
const controller = require('./attendance.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');

router.post('/clock-in',      authenticate, controller.clockIn);
router.post('/clock-out',     authenticate, controller.clockOut);
router.get('/today',          authenticate, controller.getTodayStatus);
router.get('/my/history',     authenticate, controller.getMyHistory);
router.get('/my/summary',     authenticate, controller.getMySummary);

router.get('/',
  authenticate,
  authorize('attendance', 'list'),
  controller.getAll
);

router.get('/department/summary',
  authenticate,
  authorize('attendance', 'list'),
  controller.getDepartmentSummary
);

router.get('/employee/:id/summary',
  authenticate,
  authorize('attendance', 'read'),
  controller.getEmployeeSummary
);

router.get('/settings',
  authenticate,
  authorize('attendance', 'read'),
  controller.getSettings
);

router.patch('/settings',
  authenticate,
  authorize('attendance', 'update'),
  controller.updateSettings
);

module.exports = router;