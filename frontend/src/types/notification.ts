export interface NotificationItem {
  id: string;
  recipientId: string;
  contractFormId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  channel?: string | null;
  contractForm?: {
    id: string;
    referenceNo: string | null;
    title: string | null;
    status: string;
  } | null;
}

export interface NotificationsResponse {
  data: any;
  meta: any;
  items: NotificationItem[];
}
