const router = require('express').Router();
const auditController = require('./audit.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const auditLogger = require('../../middleware/auditLogger');

router.use(authenticate);
router.use(auditLogger);

router.get('/',                     authorize('audit', 'list'), auditController.getLogs);
router.get('/suspicious',           authorize('audit', 'list'), auditController.getSuspiciousActivity);
router.get('/user/:userId',         authorize('audit', 'read'), auditController.getUserActivity);
router.get('/resource/:resource',   authorize('audit', 'read'), auditController.getResourceActivity);

module.exports = router;