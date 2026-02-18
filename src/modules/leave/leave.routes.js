const router = require('express').Router();
const leaveController = require('./leave.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const auditLogger = require('../../middleware/auditLogger');

router.use(authenticate);
router.use(auditLogger);

router.get('/',                authorize('leave', 'list'),    leaveController.getAll);
router.get('/:id',             authorize('leave', 'read'),    leaveController.getOne);
router.post('/',               authorize('leave', 'create'),  leaveController.create);
router.patch('/:id/approve',   authorize('leave', 'approve'), leaveController.approve);
router.patch('/:id/reject',    authorize('leave', 'reject'),  leaveController.reject);
router.patch('/:id/cancel',    authorize('leave', 'cancel'),  leaveController.cancel);

module.exports = router;