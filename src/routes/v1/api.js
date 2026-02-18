const router = require('express').Router();

router.use('/auth', require('../../modules/auth/auth.routes'));
router.use('/resources', require('../../modules/resources/resource.routes'));
router.use('/roles', require('../../modules/roles/role.routes'));

module.exports = router;