const router = require('express').Router();
const auditLogger = require('../../middleware/auditLogger');
const authenticate = require('../../middleware/authenticate');
const { authLimiter, passwordResetLimiter } = require('../../middleware/rateLimiter');
const authController = require('./auth.controller');

router.use(auditLogger);

router.post('/register',           authLimiter, authController.register);
router.post('/login',              authLimiter, authController.login);
router.post('/refresh',            authLimiter, authController.refresh);
router.post('/forgot-password',    passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password',     passwordResetLimiter, authController.resetPassword);

router.post('/logout',             authenticate, authController.logout);
router.post('/logout-all',         authenticate, authController.logoutAll);
router.get('/profile',             authenticate, authController.profile);

module.exports = router;