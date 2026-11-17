import { ContractStatus, Prisma, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/app-error';
import { ContractDraftInput } from '../schemas/contract.schema';

type AuthUser = { id: string; role: UserRole };

const editableStatuses: ContractStatus[] = [ContractStatus.DRAFT, ContractStatus.RETURNED];

function decimal(value?: string | null): Prisma.Decimal | null | undefined {
  return value == null ? value : new Prisma.Decimal(value);
}

function requiredDecimal(value: Prisma.Decimal | null | undefined, field: string) {
  if (value == null) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} is required`, [{ path: field, message: 'Required' }]);
  }
  return value;
}

function assertNonNegative(value: Prisma.Decimal, field: string) {
  if (value.isNegative()) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} must be non-negative`, [
      { path: field, message: 'Must be non-negative' },
    ]);
  }

}

function calculateCostAmount(quantity?: string | null, unitCost?: string | null) {
  if (quantity == null || unitCost == null) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Quantity and unit cost are required to calculate the amount');
  }
  const parsedQuantity = new Prisma.Decimal(quantity);
  const parsedUnitCost = new Prisma.Decimal(unitCost);
  assertNonNegative(parsedQuantity, 'quantity');
  assertNonNegative(parsedUnitCost, 'unitCost');
  return parsedQuantity.mul(parsedUnitCost);
}

function assertAuthenticated(user: AuthUser | undefined): asserts user is AuthUser {
  if (!user) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
}

async function getEditableForm(formId: string, user: AuthUser) {
  assertAuthenticated(user);
  const form = await prisma.contractForm.findUnique({ where: { id: formId } });
  if (!form) throw new AppError(404, 'FORM_NOT_FOUND', 'Contract form not found');
  if (form.createdById !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You are not authorized to access this contract');
  }
  if (!editableStatuses.includes(form.status)) {
    throw new AppError(409, 'INVALID_STATE', 'Only draft or returned forms can be edited');
  }
  return form;
}

async function getAccessibleForm(formId: string, user: AuthUser) {
  assertAuthenticated(user);
  const form = await prisma.contractForm.findUnique({ where: { id: formId } });
  if (!form) throw new AppError(404, 'FORM_NOT_FOUND', 'Contract form not found');
  if (
    user.role !== UserRole.ADMIN &&
    form.createdById !== user.id &&
    !(
      user.role === UserRole.APPROVER &&
      (await prisma.approvalStep.findFirst({ where: { contractFormId: formId, approverId: user.id } }))
    )
  ) {
    throw new AppError(403, 'FORBIDDEN', 'You are not authorized to access this contract');
  }
  return form;
}

async function validateRecommendedVendor(
  formId: string,
  recommendedVendorId: string | null | undefined,
) {
  if (!recommendedVendorId) return;
  const bidder = await prisma.bidder.findFirst({
    where: { contractFormId: formId, vendorId: recommendedVendorId },
  });
  if (!bidder) {
    throw new AppError(
      409,
      'INVALID_RECOMMENDED_VENDOR',
      'Recommended vendor must be one of the contract bidders',
    );
  }
}

export async function createDraft(user: AuthUser, input: ContractDraftInput) {
  assertAuthenticated(user);
  if (user.role !== UserRole.SUBMITTER && user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'FORBIDDEN', 'Only submitters or administrators can create contracts');
  }
  if (input.recommendedVendorId || input.recommendedBidderId) {
    throw new AppError(
      409,
      'INVALID_RECOMMENDED_VENDOR',
      'Recommended vendor must be added as a bidder before it can be selected',
    );
  }
  return prisma.contractForm.create({
    data: {
      ...input,
      contractAmount: decimal(input.contractAmount),
      createdById: user.id,
      status: ContractStatus.DRAFT,
    },
  });
}

export async function listContracts(user: AuthUser, query: {
  page: number; pageSize: number; status?: ContractStatus; departmentId?: string;
  contractCategoryId?: string; recommendedVendorId?: string; q?: string;
  from?: Date; to?: Date;
}) {
  assertAuthenticated(user);
  const visibilityWhere: Prisma.ContractFormWhereInput =
    user.role === UserRole.ADMIN
      ? {}
      : user.role === UserRole.APPROVER
        ? { approvalSteps: { some: { approverId: user.id } } }
        : { createdById: user.id };
  const where: Prisma.ContractFormWhereInput = {
    ...visibilityWhere,
    ...(query.status ? { status: query.status } : {}),
    ...(query.departmentId ? { sponsorDepartmentId: query.departmentId } : {}),
    ...(query.contractCategoryId ? { contractCategoryId: query.contractCategoryId } : {}),
    ...(query.recommendedVendorId ? { recommendedVendorId: query.recommendedVendorId } : {}),
    ...(query.q ? { OR: [{ title: { contains: query.q, mode: 'insensitive' } }, { referenceNo: { contains: query.q, mode: 'insensitive' } }] } : {}),
    ...(query.from || query.to ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
  };
  const [items, totalItems] = await prisma.$transaction([
    prisma.contractForm.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { sponsorDepartment: true, contractCategory: true, currency: true, recommendedVendor: true },
    }),
    prisma.contractForm.count({ where }),
  ]);
  return { items, pagination: { page: query.page, pageSize: query.pageSize, totalItems, totalPages: Math.ceil(totalItems / query.pageSize) } };
}

export async function getContract(formId: string, user: AuthUser) {
  await getAccessibleForm(formId, user);
  return prisma.contractForm.findUniqueOrThrow({
    where: { id: formId },
    include: {
      createdBy: { select: { id: true, fullName: true, email: true, role: true } },
      sponsorDepartment: true,
      contractCategory: true,
      currency: true,
      recommendedVendor: true,
      recommendedBidder: { include: { vendor: true } },
      bidders: { orderBy: { sortOrder: 'asc' }, include: { vendor: true, quotations: { include: { currency: true } } } },
      evaluations: { include: { bidder: { include: { vendor: true } } } },
      costLines: { orderBy: { sortOrder: 'asc' } },
      attachments: { select: { id: true, category: true, fileName: true, mimeType: true, sizeBytes: true, uploadedById: true, createdAt: true } },
      approvalSteps: { include: { decisions: true } },
      approvalDecisions: true,
      auditLogs: true,
    },
  });
}

export async function updateContract(formId: string, user: AuthUser, input: ContractDraftInput) {
  await getEditableForm(formId, user);
  if (Object.prototype.hasOwnProperty.call(input, 'recommendedVendorId')) {
    await validateRecommendedVendor(formId, input.recommendedVendorId);
  }
  if (input.recommendedBidderId) {
    const bidder = await prisma.bidder.findFirst({ where: { id: input.recommendedBidderId, contractFormId: formId } });
    if (!bidder) throw new AppError(409, 'INVALID_RECOMMENDED_BIDDER', 'Recommended bidder must belong to this contract');
  }
  return prisma.contractForm.update({
    where: { id: formId },
    data: {
      ...input,
      ...(Object.prototype.hasOwnProperty.call(input, 'contractAmount') ? { contractAmount: decimal(input.contractAmount) } : {}),
    },
  });
}

export async function listDrafts(user: AuthUser) {
  assertAuthenticated(user);
  return prisma.contractForm.findMany({
    where: { createdById: user.id, status: ContractStatus.DRAFT },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function deleteContract(formId: string, user: AuthUser) {
  await getEditableForm(formId, user);
  return prisma.$transaction(async (tx) => {
    await tx.contractForm.update({ where: { id: formId }, data: { recommendedBidderId: null, recommendedVendorId: null } });
    const bidders = await tx.bidder.findMany({ where: { contractFormId: formId }, select: { id: true } });
    const bidderIds = bidders.map((bidder) => bidder.id);
    if (bidderIds.length) {
      await tx.quotation.deleteMany({ where: { bidderId: { in: bidderIds } } });
      await tx.evaluation.deleteMany({ where: { bidderId: { in: bidderIds } } });
    }
    await tx.approvalDecision.deleteMany({ where: { contractFormId: formId } });
    await tx.approvalStep.deleteMany({ where: { contractFormId: formId } });
    await tx.attachment.deleteMany({ where: { contractFormId: formId } });
    await tx.notification.deleteMany({ where: { contractFormId: formId } });
    await tx.auditLog.deleteMany({ where: { contractFormId: formId } });
    await tx.costLine.deleteMany({ where: { contractFormId: formId } });
    await tx.bidder.deleteMany({ where: { contractFormId: formId } });
    return tx.contractForm.delete({ where: { id: formId } });
  });
}

async function validateSubmission(formId: string) {
  const form = await prisma.contractForm.findUnique({
    where: { id: formId },
    include: {
      bidders: { include: { quotations: true } },
      evaluations: true,
      costLines: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!form) throw new AppError(404, 'FORM_NOT_FOUND', 'Contract form not found');

  const requiredFields: Array<[string, unknown]> = [
    ['title', form.title],
    ['sponsorDepartmentId', form.sponsorDepartmentId],
    ['contractCategoryId', form.contractCategoryId],
    ['scope', form.scope],
    ['procurementRationale', form.procurementRationale],
    ['contractAmount', form.contractAmount],
  ];
  const missing = requiredFields
    .filter(([, value]) => value == null || (typeof value === 'string' && !value.trim()))
    .map(([path]) => ({ path, message: 'Required' }));
  if (missing.length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', missing);
  }

  assertNonNegative(requiredDecimal(form.contractAmount, 'contractAmount'), 'contractAmount');
  if ((form.recommendedVendorId || form.recommendedBidderId) && !form.selectionRationale?.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Selection rationale is required for a recommended vendor', [
      { path: 'selectionRationale', message: 'Required when recommendedVendorId is set' },
    ]);
  }
  if (!form.bidders.length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one bidder is required', [
      { path: 'bidders', message: 'At least one bidder is required' },
    ]);
  }
  for (const bidder of form.bidders) {
    if (!bidder.quotations.length) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Every bidder must have a quotation', [
        { path: 'quotations', message: `Bidder ${bidder.id} must have a quotation` },
      ]);
    }
    for (const quotation of bidder.quotations) assertNonNegative(quotation.quotedAmount, 'quotedAmount');
  }
  if (!form.costLines.length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one cost line is required', [
      { path: 'costLines', message: 'At least one cost line is required' },
    ]);
  }
  let subtotal = new Prisma.Decimal(0);
  for (const line of form.costLines) {
    assertNonNegative(line.amount, 'amount');
    if (line.quantity != null) assertNonNegative(line.quantity, 'quantity');
    if (line.unitCost != null) assertNonNegative(line.unitCost, 'unitCost');
    if (line.quantity != null && line.unitCost != null && !line.quantity.mul(line.unitCost).equals(line.amount)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Cost line amount must equal quantity multiplied by unit cost', [
        { path: 'costLines.amount', message: `Cost line ${line.id} has an inconsistent amount` },
      ]);
    }
    subtotal = subtotal.add(line.amount);
  }
  const bidderIds = new Set(form.bidders.map((bidder) => bidder.id));
  const evaluationKeys = new Set<string>();
  for (const evaluation of form.evaluations) {
    if (!bidderIds.has(evaluation.bidderId)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Evaluation bidder must belong to this contract', [
        { path: 'evaluations.bidderId', message: 'Invalid bidder reference' },
      ]);
    }
    if (evaluation.score != null) assertNonNegative(evaluation.score, 'score');
    if (!evaluation.remarks?.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Evaluation remarks are required', [
        { path: 'evaluations.remarks', message: 'Required' },
      ]);
    }
    evaluationKeys.add(`${evaluation.bidderId}:${evaluation.type}`);
  }
  for (const bidder of form.bidders) {
    for (const type of ['TECHNICAL', 'COMMERCIAL']) {
      if (!evaluationKeys.has(`${bidder.id}:${type}`)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Technical and commercial evaluations are required', [
          { path: 'evaluations', message: `Missing ${type} evaluation for bidder ${bidder.id}` },
        ]);
      }
    }
  }
  return { form, subtotal };
}

export async function submitContract(formId: string, user: AuthUser) {
  const form = await getEditableForm(formId, user);
  if (form.status !== ContractStatus.DRAFT && form.status !== ContractStatus.RETURNED) {
    throw new AppError(409, 'INVALID_STATE', 'Only draft or returned forms can be submitted');
  }
  await validateSubmission(formId);
  const updated = await prisma.contractForm.updateMany({
    where: { id: formId, status: form.status },
    data: { status: ContractStatus.PENDING_APPROVAL, submittedAt: new Date() },
  });
  if (updated.count !== 1) {
    throw new AppError(409, 'INVALID_STATE', 'Contract has already been submitted or changed');
  }
  return prisma.contractForm.findUniqueOrThrow({ where: { id: formId } });
}

export async function listBidders(formId: string, user: AuthUser) {
  await getAccessibleForm(formId, user);
  return prisma.bidder.findMany({ where: { contractFormId: formId }, orderBy: { sortOrder: 'asc' }, include: { vendor: true, quotations: true } });
}

export async function createBidder(formId: string, user: AuthUser, input: { vendorId?: string | null; companyName?: string; contactPerson?: string | null; email?: string | null; phone?: string | null; qualifications?: string | null; sortOrder: number }) {
  await getEditableForm(formId, user);
  const vendor = input.vendorId ? await prisma.vendor.findUnique({ where: { id: input.vendorId } }) : null;
  if (input.vendorId && !vendor) throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
  const companyName = input.companyName?.trim() || vendor?.name;
  if (!companyName) throw new AppError(400, 'VALIDATION_ERROR', 'Company name is required');
  const duplicate = await prisma.bidder.findFirst({ where: { contractFormId: formId, OR: [
    ...(input.vendorId ? [{ vendorId: input.vendorId }] : []),
    { companyName: { equals: companyName, mode: 'insensitive' } },
  ] } });
  if (duplicate) throw new AppError(409, 'DUPLICATE_BIDDER', 'This company is already a bidder on the contract');
  return prisma.$transaction(async (tx) => tx.bidder.create({ data: { ...input, companyName, contractFormId: formId }, include: { vendor: true, quotations: true } }));
}

export async function updateBidder(formId: string, bidderId: string, user: AuthUser, input: Partial<{ vendorId: string | null; companyName: string; contactPerson: string | null; email: string | null; phone: string | null; qualifications: string | null; sortOrder: number }>) {
  const form = await getEditableForm(formId, user);
  const bidder = await prisma.bidder.findFirst({ where: { id: bidderId, contractFormId: formId } });
  if (!bidder) throw new AppError(404, 'BIDDER_NOT_FOUND', 'Bidder not found');
  if (input.vendorId && input.vendorId !== bidder.vendorId) {
    if (form.recommendedVendorId === bidder.vendorId || form.recommendedBidderId === bidder.id) {
      throw new AppError(
        409,
        'RECOMMENDED_VENDOR_BIDDER_CONFLICT',
        'Cannot change the bidder vendor while it is the contract recommended vendor',
      );
    }
    if (!(await prisma.vendor.findUnique({ where: { id: input.vendorId } }))) {
      throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
    }
  }
  if (input.vendorId && !(await prisma.vendor.findUnique({ where: { id: input.vendorId } }))) {
    throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
  }
  if (input.companyName || input.vendorId !== undefined) {
    const duplicate = await prisma.bidder.findFirst({ where: { contractFormId: formId, id: { not: bidderId }, OR: [
      ...(input.vendorId ? [{ vendorId: input.vendorId }] : []),
      ...(input.companyName ? [{ companyName: { equals: input.companyName, mode: 'insensitive' as const } }] : []),
    ] } });
    if (duplicate) throw new AppError(409, 'DUPLICATE_BIDDER', 'This company is already a bidder on the contract');
  }
  return prisma.$transaction(async (tx) => tx.bidder.update({ where: { id: bidderId }, data: input, include: { vendor: true, quotations: true } }));
}

export async function deleteBidder(formId: string, bidderId: string, user: AuthUser) {
  const form = await getEditableForm(formId, user);
  const bidder = await prisma.bidder.findFirst({ where: { id: bidderId, contractFormId: formId } });
  if (!bidder) throw new AppError(404, 'BIDDER_NOT_FOUND', 'Bidder not found');
  if (form.recommendedVendorId === bidder.vendorId || form.recommendedBidderId === bidder.id) {
    throw new AppError(
      409,
      'RECOMMENDED_VENDOR_BIDDER_CONFLICT',
      'Cannot delete the bidder for the contract recommended vendor',
    );
  }
  const evaluation = await prisma.evaluation.findFirst({
    where: { bidderId, contractFormId: formId },
    select: { id: true },
  });
  if (evaluation) {
    throw new AppError(
      409,
      'BIDDER_HAS_EVALUATIONS',
      'Cannot delete a bidder with evaluation records',
    );
  }
  return prisma.$transaction(async (tx) => {
    await tx.quotation.deleteMany({ where: { bidderId } });
    return tx.bidder.delete({ where: { id: bidderId } });
  });
}

export async function listQuotations(formId: string, bidderId: string, user: AuthUser) {
  await getAccessibleForm(formId, user);
  const bidder = await prisma.bidder.findFirst({ where: { id: bidderId, contractFormId: formId } });
  if (!bidder) throw new AppError(404, 'BIDDER_NOT_FOUND', 'Bidder not found');
  return prisma.quotation.findMany({ where: { bidderId }, include: { currency: true } });
}

export async function createQuotation(formId: string, bidderId: string, user: AuthUser, input: { quotedAmount: string; currencyId?: string | null; quotationDate?: Date | null; notes?: string | null }) {
  await getEditableForm(formId, user);
  const bidder = await prisma.bidder.findFirst({ where: { id: bidderId, contractFormId: formId } });
  if (!bidder) throw new AppError(404, 'BIDDER_NOT_FOUND', 'Bidder not found');
  const quotedAmount = new Prisma.Decimal(input.quotedAmount);
  assertNonNegative(quotedAmount, 'quotedAmount');
  if (input.currencyId && !(await prisma.currency.findUnique({ where: { id: input.currencyId } }))) {
    throw new AppError(404, 'CURRENCY_NOT_FOUND', 'Currency not found');
  }
  return prisma.$transaction(async (tx) => tx.quotation.create({ data: { ...input, quotedAmount, bidderId }, include: { currency: true } }));
}

export async function updateQuotation(formId: string, bidderId: string, quotationId: string, user: AuthUser, input: Partial<{ quotedAmount: string; currencyId?: string | null; quotationDate?: Date | null; notes?: string | null }>) {
  await getEditableForm(formId, user);
  const quotation = await prisma.quotation.findFirst({ where: { id: quotationId, bidderId, bidder: { contractFormId: formId } } });
  if (!quotation) throw new AppError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  if (
    input.currencyId !== undefined &&
    input.currencyId !== null &&
    !(await prisma.currency.findUnique({ where: { id: input.currencyId } }))
  ) {
    throw new AppError(404, 'CURRENCY_NOT_FOUND', 'Currency not found');
  }
  const quotedAmount = input.quotedAmount === undefined ? undefined : new Prisma.Decimal(input.quotedAmount);
  if (quotedAmount) assertNonNegative(quotedAmount, 'quotedAmount');
  return prisma.$transaction(async (tx) => tx.quotation.update({ where: { id: quotationId }, data: { ...input, ...(quotedAmount ? { quotedAmount } : {}) }, include: { currency: true } }));
}

export async function deleteQuotation(formId: string, bidderId: string, quotationId: string, user: AuthUser) {
  await getEditableForm(formId, user);
  const quotation = await prisma.quotation.findFirst({ where: { id: quotationId, bidderId, bidder: { contractFormId: formId } } });
  if (!quotation) throw new AppError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  return prisma.$transaction(async (tx) => tx.quotation.delete({ where: { id: quotationId } }));
}

export async function listCostLines(formId: string, user: AuthUser) {
  await getAccessibleForm(formId, user);
  return prisma.costLine.findMany({ where: { contractFormId: formId }, orderBy: { sortOrder: 'asc' } });
}

export async function getCostEstimate(formId: string, user: AuthUser) {
  await getAccessibleForm(formId, user);
  const lines = await prisma.costLine.findMany({ where: { contractFormId: formId }, orderBy: { sortOrder: 'asc' } });
  const subtotal = lines.reduce((total, line) => total.add(line.amount), new Prisma.Decimal(0));
  return { lines, subtotal, tax: new Prisma.Decimal(0), total: subtotal };
}

export async function createCostLine(formId: string, user: AuthUser, input: { description: string; quantity?: string | null; unitCost?: string | null; amount?: string; sortOrder: number }) {
  await getEditableForm(formId, user);
  const amount = calculateCostAmount(input.quantity, input.unitCost);
  return prisma.$transaction(async (tx) => tx.costLine.create({ data: { ...input, contractFormId: formId, quantity: decimal(input.quantity), unitCost: decimal(input.unitCost), amount } }));
}

export async function updateCostLine(formId: string, lineId: string, user: AuthUser, input: Partial<{ description: string; quantity?: string | null; unitCost?: string | null; amount?: string; sortOrder: number }>) {
  await getEditableForm(formId, user);
  const line = await prisma.costLine.findFirst({ where: { id: lineId, contractFormId: formId } });
  if (!line) throw new AppError(404, 'COST_LINE_NOT_FOUND', 'Cost line not found');
  const quantity = input.quantity !== undefined ? decimal(input.quantity) : line.quantity;
  const unitCost = input.unitCost !== undefined ? decimal(input.unitCost) : line.unitCost;
  const amount = input.quantity !== undefined || input.unitCost !== undefined
    ? calculateCostAmount(quantity?.toString(), unitCost?.toString())
    : line.amount;
  if (quantity != null) assertNonNegative(quantity, 'quantity');
  if (unitCost != null) assertNonNegative(unitCost, 'unitCost');
  assertNonNegative(amount, 'amount');
  return prisma.$transaction(async (tx) => tx.costLine.update({ where: { id: lineId }, data: { ...input, ...(input.quantity !== undefined ? { quantity: decimal(input.quantity) } : {}), ...(input.unitCost !== undefined ? { unitCost: decimal(input.unitCost) } : {}), amount } }));
}

export async function listEvaluations(formId: string, user: AuthUser) {
  await getAccessibleForm(formId, user);
  return prisma.evaluation.findMany({
    where: { contractFormId: formId },
    orderBy: [{ bidderId: 'asc' }, { type: 'asc' }],
    include: { bidder: { include: { vendor: true } } },
  });
}

export async function saveEvaluations(formId: string, user: AuthUser, inputs: import('../schemas/contract.schema').EvaluationInput[]) {
  await getEditableForm(formId, user);
  return prisma.$transaction(async (tx) => {
    const saved = [];
    for (const input of inputs) {
      const bidder = await tx.bidder.findFirst({ where: { id: input.bidderId, contractFormId: formId } });
      if (!bidder) throw new AppError(400, 'INVALID_BIDDER_REFERENCE', 'Evaluation bidder must belong to this contract');
      if (input.score != null) assertNonNegative(new Prisma.Decimal(input.score), 'score');
      const existing = await tx.evaluation.findFirst({
        where: { contractFormId: formId, bidderId: input.bidderId, type: input.type },
      });
      saved.push(existing
        ? await tx.evaluation.update({
          where: { id: existing.id },
          data: { score: decimal(input.score), remarks: input.remarks, evaluatedById: user.id },
        })
        : await tx.evaluation.create({
          data: { ...input, contractFormId: formId, score: decimal(input.score), evaluatedById: user.id },
        }));
    }
    return saved;
  });
}

export async function deleteCostLine(formId: string, lineId: string, user: AuthUser) {
  await getEditableForm(formId, user);
  const line = await prisma.costLine.findFirst({ where: { id: lineId, contractFormId: formId } });
  if (!line) throw new AppError(404, 'COST_LINE_NOT_FOUND', 'Cost line not found');
  return prisma.$transaction(async (tx) => tx.costLine.delete({ where: { id: lineId } }));
}
