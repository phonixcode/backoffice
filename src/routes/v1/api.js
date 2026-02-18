const router = require('express').Router();

router.use('/auth',                 require('../../modules/auth/auth.routes'));
router.use('/resources',            require('../../modules/resources/resource.routes'));
router.use('/roles',                require('../../modules/roles/role.routes'));
router.use('/users',                require('../../modules/users/user.routes'));
router.use('/employees',            require('../../modules/employees/employee.routes'));
router.use('/departments',          require('../../modules/departments/department.routes'));
router.use('/payroll',              require('../../modules/payroll/payroll.routes'));
router.use('/leave',                require('../../modules/leave/leave.routes'));
router.use('/audit',                require('../../modules/audit/audit.routes'));

module.exports = router;