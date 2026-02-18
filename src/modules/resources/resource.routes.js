const router = require('express').Router();
const resourceController = require('./resource.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const auditLogger = require('../../middleware/auditLogger');

router.use(authenticate);
router.use(auditLogger);

router.post('/',                            authorize('resources', 'create'), resourceController.create);
router.get('/',                             authorize('resources', 'list'),   resourceController.getAll);
router.get('/:id',                          authorize('resources', 'read'),   resourceController.getOne);
router.post('/:id/permissions/custom',      authorize('resources', 'update'), resourceController.addCustomPermission);
router.delete('/:id',                       authorize('resources', 'delete'), resourceController.delete);

module.exports = router;