import { z } from 'zod';
import { USER_UPLOAD_CATEGORIES } from './attachment.types';

/** ID format is not agreed yet (P0), so only basic safety is enforced. */
const idSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const contractParamsSchema = z.object({ contractFormId: idSchema });
export const attachmentParamsSchema = z.object({
  contractFormId: idSchema,
  attachmentId: idSchema,
});
export const uploadBodySchema = z.object({
  category: z.enum(USER_UPLOAD_CATEGORIES as unknown as [string, ...string[]]),
});
