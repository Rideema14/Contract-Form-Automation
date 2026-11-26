import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/response';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notification.service';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from '../schemas/notification.schema';

/**
 * GET /notifications
 * Retrieves notifications for the authenticated user.
 */
export async function getNotificationsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    const query = listNotificationsQuerySchema.parse(req.query);
    const result = await getUserNotifications(authUser.id, query);

    sendSuccess(
      req,
      res,
      200,
      'Notifications retrieved',
      { items: result.items },
      { pagination: result.pagination }
    );
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /notifications/:id/read
 * Marks a specific notification as read.
 */
export async function markNotificationReadHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    const params = notificationIdParamSchema.parse(req.params);
    const updated = await markNotificationAsRead(params.id, authUser.id);

    sendSuccess(req, res, 200, 'Notification marked as read', updated);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /notifications/mark-all-read
 * Marks all notifications as read for the authenticated user.
 */
export async function markAllReadHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authUser = req.authUser;
    if (!authUser) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    await markAllNotificationsAsRead(authUser.id);
    sendSuccess(req, res, 200, 'All notifications marked as read', { success: true });
  } catch (error) {
    next(error);
  }
}
