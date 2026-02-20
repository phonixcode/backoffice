const router     = require('express').Router();
const controller = require('./dashboard.controller');
const authenticate = require('../../middleware/authenticate');
const authorize    = require('../../middleware/authorize');

router.use(authenticate);

router.get('/overview', authorize('dashboard', 'read'), controller.getOverview);
router.get('/hr',       authorize('dashboard', 'read'), controller.getHRStats);
router.get('/payroll',  authorize('dashboard', 'read'), controller.getPayrollStats);
router.get('/leave',    authorize('dashboard', 'read'), controller.getLeaveStats);
router.get('/activity', authorize('dashboard', 'read'), controller.getActivityFeed);

module.exports = router;