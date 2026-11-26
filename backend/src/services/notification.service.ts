import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/app-error';
import { ListNotificationsQuery } from '../schemas/notification.schema';

/**
 * Retrieves paginated notifications belonging exclusively to the authenticated user.
 */
export async function getUserNotifications(
  userId: string,
  query: ListNotificationsQuery
) {
  const where: Prisma.NotificationWhereInput = {
    recipientId: userId,
    ...(query.unreadOnly ? { isRead: false } : {}),
  };

  const [items, totalItems] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        recipientId: true,
        contractFormId: true,
        message: true,
        isRead: true,
        createdAt: true,
        channel: true,
        contractForm: {
          select: {
            id: true,
            referenceNo: true,
            title: true,
            status: true,
          },
        },
      },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    },
  };
}

/**
 * Marks a single notification as read, ensuring ownership by the authenticated user.
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, recipientId: true, isRead: true },
  });

  if (!notification) {
    throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  }

  if (notification.recipientId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied to this notification');
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

/**
 * Marks all unread notifications as read for the authenticated user.
 */
export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      recipientId: userId,
      isRead: false,
    },
    data: { isRead: true },
  });
}
