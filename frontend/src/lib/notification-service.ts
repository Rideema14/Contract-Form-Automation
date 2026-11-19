import { apiGet, apiPatch } from '@/lib/api-client';
import type { NotificationItem, NotificationsResponse } from '@/types/notification';

export interface GetNotificationsParams {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

/**
 * Fetch notifications for the authenticated user.
 * Endpoint: GET /notifications
 */
export async function getUserNotifications(params?: GetNotificationsParams): Promise<{
  items: NotificationItem[];
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
  if (params?.unreadOnly !== undefined) searchParams.set('unreadOnly', String(params.unreadOnly));

  const qs = searchParams.toString();
  const endpoint = qs ? `/notifications?${qs}` : '/notifications';

  const response = await apiGet<NotificationsResponse>(endpoint);
  return {
    items: response.data?.items ?? [],
    pagination: response.meta?.pagination,
  };
}

/**
 * Mark a single notification as read.
 * Endpoint: PATCH /notifications/:id/read
 */
export async function markNotificationAsRead(id: string): Promise<void> {
  await apiPatch(`/notifications/${id}/read`);
}

/**
 * Mark all notifications as read for the current user.
 * Endpoint: PATCH /notifications/mark-all-read
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  await apiPatch('/notifications/mark-all-read');
}
