const router = require('express').Router();
const employeeController = require('./employee.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

router.use(authenticate);

router.get('/',                     authorize(), employeeController.getAll);
router.post('/',                    authorize(), employeeController.create);
router.get('/:id',                  authorize(), employeeController.getOne);
router.patch('/:id',                authorize(), employeeController.update);
router.patch('/:id/terminate',      authorize('employees', 'terminate'), employeeController.terminate);

module.exports = router;