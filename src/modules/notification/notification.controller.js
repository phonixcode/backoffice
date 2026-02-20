const notificationService = require('./notification.service');
const { sseManager }      = require('./sse.manager');
const asyncHandler        = require('../../utils/asyncHandler');
const apiResponse         = require('../../utils/apiResponse');

const notificationController = {

    stream: (req, res) => {
        let userId = req.user?._id?.toString();

        if (!userId) {
            return res.status(401).end();
        }

        res.setHeader('Content-Type',      'text/event-stream');
        res.setHeader('Cache-Control',     'no-cache');
        res.setHeader('Connection',        'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        sseManager.addClient(userId, res);

        res.write(`event: connected\n`);
        res.write(`data: ${JSON.stringify({ message: 'Connected' })}\n\n`);

        notificationService.getUnreadCount(req.user).then(count => {
            res.write(`event: unread_count\n`);
            res.write(`data: ${JSON.stringify({ count })}\n\n`);
        });

        req.on('close', () => {
            sseManager.removeClient(userId, res);
        });
    },

  getAll: asyncHandler(async (req, res) => {
    const result = await notificationService.getForUser(req.user, req.query);
    return apiResponse.success(res, 'Notifications fetched', result);
  }),

  getUnreadCount: asyncHandler(async (req, res) => {
    const count = await notificationService.getUnreadCount(req.user);
    return apiResponse.success(res, 'Unread count', { count });
  }),

  markAsRead: asyncHandler(async (req, res) => {
    await notificationService.markAsRead(req.params.id, req.user._id);
    return apiResponse.success(res, 'Notification marked as read');
  }),

  markAllAsRead: asyncHandler(async (req, res) => {
    await notificationService.markAllAsRead(req.user);
    return apiResponse.success(res, 'All notifications marked as read');
  }),

  delete: asyncHandler(async (req, res) => {
    await notificationService.deleteNotification(req.params.id);
    return apiResponse.success(res, 'Notification deleted');
  })
};

module.exports = notificationController;