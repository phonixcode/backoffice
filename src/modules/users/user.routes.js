const router = require('express').Router();
const userController = require('./user.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

router.use(authenticate);

router.get('/',                                        authorize('users', 'list'),   userController.getAll);
router.post('/',                                       authorize('users', 'create'), userController.create);
router.get('/:id',                                     authorize('users', 'read'),   userController.getOne);
router.patch('/:id',                                   authorize('users', 'update'), userController.update);
router.patch('/:id/roles',                             authorize('users', 'update'), userController.assignRoles);
router.post('/:id/permissions',                        authorize('users', 'update'), userController.addDirectPermissions);
router.delete('/:id/permissions/:permissionId',        authorize('users', 'update'), userController.removeDirectPermission);
router.patch('/:id/toggle-status',                     authorize('users', 'update'), userController.toggleStatus);

router.patch('/profile/change-password', userController.changePassword);

module.exports = router;