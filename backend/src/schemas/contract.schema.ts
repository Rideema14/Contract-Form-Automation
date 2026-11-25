import { z } from 'zod';
import { dynamicValuesSchema } from './form-builder.schema';

const uuid = z.string().uuid();
const decimal = z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/, 'Must be a non-negative decimal with up to 4 decimal places');
const optionalText = z.string().trim().max(10000).optional().nullable();

export const contractIdSchema = z.object({ id: uuid }).strict();

export const contractDraftSchema = z.object({
  referenceNo: z.string().trim().max(255).optional().nullable(),
  title: z.string().trim().min(1).max(255).optional().nullable(),
  sponsorDepartmentId: uuid.optional().nullable(),
  contractCategoryId: uuid.optional().nullable(),
  scope: optionalText,
  procurementRationale: optionalText,
  contractAmount: decimal.optional().nullable(),
  budgetProvision: decimal.optional().nullable(),
  currencyId: uuid.optional().nullable(),
  recommendedVendorId: uuid.optional().nullable(),
  recommendedBidderId: uuid.optional().nullable(),
  selectionRationale: optionalText,
  dynamicValues: dynamicValuesSchema.optional(),
}).strict();

export const createContractSchema = contractDraftSchema.extend({
  formSchemaVersionId: z.string().min(1).max(255).optional(),
}).strict();

export const contractListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'RETURNED', 'APPROVED', 'REJECTED']).optional(),
  departmentId: uuid.optional(),
  contractCategoryId: uuid.optional(),
  recommendedVendorId: uuid.optional(),
  q: z.string().trim().max(255).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: 'from must be earlier than or equal to to',
  path: ['to'],
});

export const bidderSchema = z.object({
  vendorId: uuid.optional().nullable(),
  vendorTypeId: uuid.optional().nullable(),
  companyName: z.string().trim().min(1).max(255).optional(),
  contactPerson: z.string().trim().max(255).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable(),
  phone: z.string().trim().max(100).optional().nullable(),
  qualifications: z.string().trim().max(10000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();

export const bidderParamsSchema = z.object({
  formId: uuid,
  bidderId: uuid,
}).strict();

export const quotationSchema = z.object({
  quotedAmount: decimal,
  currencyId: uuid.optional().nullable(),
  quotationDate: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(10000).optional().nullable(),
}).strict();

export const quotationParamsSchema = bidderParamsSchema.extend({ quotationId: uuid }).strict();

export const costLineSchema = z.object({
  description: z.string().trim().min(1).max(10000),
  quantity: decimal.optional().nullable(),
  unitCost: decimal.optional().nullable(),
  amount: decimal.optional(),
  sortOrder: z.number().int().min(0),
}).strict();

export const costLineParamsSchema = z.object({
  formId: uuid,
  lineId: uuid,
}).strict();

export const evaluationSchema = z.object({
  bidderId: uuid,
  type: z.enum(['TECHNICAL', 'COMMERCIAL']),
  score: decimal.optional().nullable(),
  remarks: optionalText,
}).strict();

export const evaluationsSchema = z.object({
  evaluations: z.array(evaluationSchema).min(1),
}).strict();

export const evaluationParamsSchema = z.object({
  formId: uuid,
  evaluationId: uuid,
}).strict();

export const submitSchema = z.object({}).strict();

export type ContractDraftInput = z.infer<typeof contractDraftSchema>;
export type CreateContractInput = z.infer<typeof createContractSchema>;
export type EvaluationInput = z.infer<typeof evaluationSchema>;
