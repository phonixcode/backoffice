const router = require('express').Router();
const auditLogger = require('../../middleware/auditLogger');
const authenticate = require('../../middleware/authenticate');
const authController = require('./auth.controller');

router.use(auditLogger);

router.post('/register',            authController.register);
router.post('/login',               authController.login);
router.post('/refresh',             authController.refresh);
router.post('/logout',              authenticate, authController.logout);
router.post('/logout-all',          authenticate, authController.logoutAll);
router.get('/profile',              authenticate, authController.profile);

module.exports = router;