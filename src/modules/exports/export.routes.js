const router       = require('express').Router();
const controller   = require('./export.controller');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');

router.use(authenticate);

router.get('/employees',  authorize('employees', 'list'), controller.employees);
router.get('/payroll',    authorize('payroll',   'list'), controller.payroll);
router.get('/leave',      authorize('leave',     'list'), controller.leave);
router.get('/audit-logs', authorize('audit',     'list'), controller.auditLogs);

router.get('/job/:jobId',         controller.jobStatus);
router.get('/download/:filename', controller.download);

module.exports = router;