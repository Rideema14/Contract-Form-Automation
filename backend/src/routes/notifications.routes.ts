import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import {
  getNotificationsHandler,
  markNotificationReadHandler,
  markAllReadHandler,
} from '../controllers/notifications.controller';

const router = Router();

router.use(authenticate);

// GET /api/notifications
router.get('/', getNotificationsHandler);

// PATCH /api/notifications/mark-all-read
router.patch('/mark-all-read', markAllReadHandler);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', markNotificationReadHandler);

export default router;
