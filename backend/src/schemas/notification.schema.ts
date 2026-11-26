import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number()
    .int()
    .min(1, 'Page must be at least 1')
    .default(1),
  pageSize: z.coerce.number()
    .int()
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size cannot exceed 100')
    .default(20),
  unreadOnly: z.enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
}).strict();

export const notificationIdParamSchema = z.object({
  id: z.string().uuid('Invalid notification ID format'),
}).strict();

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
