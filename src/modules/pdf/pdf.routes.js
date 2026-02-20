const router       = require('express').Router();
const controller   = require('./pdf.controller');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');

router.use(authenticate);

router.get('/payslip/:payrollId',  authorize('payroll', 'read'), controller.payslip);
router.get('/payroll-report',      authorize('payroll', 'list'), controller.payrollReport);
router.get('/leave-report',        authorize('leave',   'list'), controller.leaveReport);
router.get('/audit-report',        authorize('audit',   'list'), controller.auditReport);

// check job status
router.get('/job/:jobId',          authenticate,                 controller.jobStatus);

// download completed PDF
router.get('/download/:filename',  authenticate,                 controller.download);


module.exports = router;