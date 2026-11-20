
import { z } from 'zod';

// Shared strict UUID validator
const uuid = z.string().uuid();

export const approvalStepIdParamSchema = z.object({
  id: uuid,
}).strict();

export const contractHistoryParamSchema = z.object({
  id: uuid,
}).strict();

export const approveActionSchema = z.object({
  comment: z.string()
    .trim()
    .max(5000, 'Comment cannot exceed 5000 characters')
    .optional()
    .nullable(),
}).strict();

export const returnActionSchema = z.object({
  comment: z.string()
    .trim()
    .min(1, 'Comment is required when returning a contract')
    .max(5000, 'Comment cannot exceed 5000 characters'),
}).strict();

export const rejectActionSchema = z.object({
  comment: z.string()
    .trim()
    .min(1, 'Comment is required when rejecting a contract')
    .max(5000, 'Comment cannot exceed 5000 characters'),
}).strict();

export const pendingApprovalsQuerySchema = z.object({
  page: z.coerce.number()
    .int()
    .min(1, 'Page must be at least 1')
    .default(1),

  pageSize: z.coerce.number()
    .int()
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size cannot exceed 100')
    .default(20),
}).strict();

export const initializeWorkflowSchema = z.object({
  approverIds: z.array(uuid, {
    message: 'approverIds must be an array of UUIDs',
  })
    .min(1, 'At least one approver must be assigned to initiate workflow')
    .refine((items) => new Set(items).size === items.length, {
      message: 'Approver list cannot contain duplicate approvers',
    }),
}).strict();

export type ApproveActionInput = z.infer<typeof approveActionSchema>;
export type ReturnActionInput = z.infer<typeof returnActionSchema>;
export type RejectActionInput = z.infer<typeof rejectActionSchema>;
export type PendingApprovalsQuery = z.infer<typeof pendingApprovalsQuerySchema>;
export type InitializeWorkflowInput = z.infer<typeof initializeWorkflowSchema>;
