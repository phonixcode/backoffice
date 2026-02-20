const router     = require('express').Router();
const controller = require('./notification.controller');
const authenticate = require('../../middleware/authenticate');

router.use(authenticate);

router.get('/stream',       controller.stream);           
router.get('/',             controller.getAll);           
router.get('/unread-count', controller.getUnreadCount);   
router.patch('/read-all',   controller.markAllAsRead);    
router.patch('/:id/read',   controller.markAsRead);       
router.delete('/:id',       controller.delete);           

module.exports = router;