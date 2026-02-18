const router = require('express').Router();
const payrollController = require('./payroll.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const auditLogger = require('../../middleware/auditLogger');

router.use(authenticate);
router.use(auditLogger);

router.get('/',                authorize('payroll', 'list'),    payrollController.getAll);
router.get('/:id',             authorize('payroll', 'read'),    payrollController.getOne);
router.post('/process',        authorize('payroll', 'process'), payrollController.process);
router.patch('/:id/approve',   authorize('payroll', 'approve'), payrollController.approve);
router.patch('/:id/mark-paid', authorize('payroll', 'update'),  payrollController.markAsPaid);

module.exports = router;