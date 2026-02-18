const router = require('express').Router();
const departmentController = require('./department.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

router.use(authenticate);

router.get('/',             authorize(), departmentController.getAll);
router.post('/',            authorize(), departmentController.create);
router.get('/:id',          authorize(), departmentController.getOne);
router.patch('/:id',        authorize(), departmentController.update);
router.delete('/:id',       authorize(), departmentController.delete);

module.exports = router;