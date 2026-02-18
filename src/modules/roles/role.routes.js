const router = require('express').Router();
const roleController = require('./role.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

router.use(authenticate);

router.post('/',                          authorize('roles', 'create'), roleController.create);
router.get('/',                           authorize('roles', 'list'),   roleController.getAll);
router.get('/:id',                        authorize('roles', 'read'),   roleController.getOne);
router.patch('/:id',                      authorize('roles', 'update'), roleController.update);              
router.patch('/:id/permissions',          authorize('roles', 'update'), roleController.updatePermissions);
router.delete('/:id',                     authorize('roles', 'delete'), roleController.delete);

module.exports = router;