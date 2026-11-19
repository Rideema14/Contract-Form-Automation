
import { ContractStatus, Prisma, UserRole } from '@prisma/client';

import { initializeOrResetApprovalWorkflow } from './approval.service';
import { initializeWorkflowSchema } from '../schemas/approval.schema';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/app-error';
import { ContractDraftInput } from '../schemas/contract.schema';

type AuthUser = { id: string; role: UserRole };

const editableStatuses: ContractStatus[] = [
  ContractStatus.DRAFT,
  ContractStatus.RETURNED,
];

function decimal(value?: string | null): Prisma.Decimal | null | undefined {
  return value == null ? value : new Prisma.Decimal(value);
}

function assertAuthenticated(
  user: AuthUser | undefined
): asserts user is AuthUser {
  if (!user) {
    throw new AppError(
      401,
      'AUTHENTICATION_REQUIRED',
      'Authentication required'
    );
  }
}

async function getEditableForm(formId: string, user: AuthUser) {
  assertAuthenticated(user);

  const form = await prisma.contractForm.findUnique({
    where: { id: formId },
  });

  if (!form) {
    throw new AppError(404, 'FORM_NOT_FOUND', 'Contract form not found');
  }

  if (form.createdById !== user.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'You are not authorized to access this contract'
    );
  }

  if (!editableStatuses.includes(form.status)) {
    throw new AppError(
      409,
      'INVALID_STATE',
      'Only draft or returned forms can be edited'
    );
  }

  return form;
}

async function getAccessibleForm(formId: string, user: AuthUser) {
  assertAuthenticated(user);

  const form = await prisma.contractForm.findUnique({
    where: { id: formId },
  });

  if (!form) {
    throw new AppError(404, 'FORM_NOT_FOUND', 'Contract form not found');
  }

  if (
    user.role !== UserRole.ADMIN &&
    form.createdById !== user.id &&
    !(
      user.role === UserRole.APPROVER &&
      (await prisma.approvalStep.findFirst({
        where: {
          contractFormId: formId,
          approverId: user.id,
        },
      }))
    )
  ) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'You are not authorized to access this contract'
    );
  }

  return form;
}

async function validateRecommendedVendor(
  formId: string,
  recommendedVendorId: string | null | undefined
) {
  if (!recommendedVendorId) return;

  const bidder = await prisma.bidder.findFirst({
    where: {
      contractFormId: formId,
      vendorId: recommendedVendorId,
    },
  });

  if (!bidder) {
    throw new AppError(
      409,
      'INVALID_RECOMMENDED_VENDOR',
      'Recommended vendor must be one of the contract bidders'
    );
  }
}

export async function createDraft(
  user: AuthUser,
  input: ContractDraftInput
) {
  assertAuthenticated(user);

  if (
    user.role !== UserRole.SUBMITTER &&
    user.role !== UserRole.ADMIN
  ) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only submitters or administrators can create contracts'
    );
  }

  if (input.recommendedVendorId) {
    throw new AppError(
      409,
      'INVALID_RECOMMENDED_VENDOR',
      'Recommended vendor must be added as a bidder before it can be selected'
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

export async function listContracts(
  user: AuthUser,
  query: {
    page: number;
    pageSize: number;
    status?: ContractStatus;
    departmentId?: string;
    contractCategoryId?: string;
    recommendedVendorId?: string;
    q?: string;
    from?: Date;
    to?: Date;
  }
) {
  assertAuthenticated(user);

  const visibilityWhere: Prisma.ContractFormWhereInput =
    user.role === UserRole.ADMIN
      ? {}
      : user.role === UserRole.APPROVER
        ? {
          approvalSteps: {
            some: {
              approverId: user.id,
            },
          },
        }
        : {
          createdById: user.id,
        };

  const where: Prisma.ContractFormWhereInput = {
    ...visibilityWhere,
    ...(query.status ? { status: query.status } : {}),
    ...(query.departmentId
      ? { sponsorDepartmentId: query.departmentId }
      : {}),
    ...(query.contractCategoryId
      ? { contractCategoryId: query.contractCategoryId }
      : {}),
    ...(query.recommendedVendorId
      ? { recommendedVendorId: query.recommendedVendorId }
      : {}),
    ...(query.q
      ? {
        OR: [
          {
            title: {
              contains: query.q,
              mode: 'insensitive',
            },
          },
          {
            referenceNo: {
              contains: query.q,
              mode: 'insensitive',
            },
          },
        ],
      }
      : {}),
    ...(query.from || query.to
      ? {
        createdAt: {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        },
      }
      : {}),
  };

  const [items, totalItems] = await prisma.$transaction([
    prisma.contractForm.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.contractForm.count({ where }),
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

export async function getContract(formId: string, user: AuthUser) {
  await getAccessibleForm(formId, user);

  return prisma.contractForm.findUniqueOrThrow({
    where: { id: formId },
    include: {
      createdBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      sponsorDepartment: true,
      contractCategory: true,
      currency: true,
      recommendedVendor: true,
      bidders: {
        orderBy: { sortOrder: 'asc' },
        include: {
          vendor: true,
          quotations: {
            include: { currency: true },
          },
        },
      },
      evaluations: true,
      costLines: {
        orderBy: { sortOrder: 'asc' },
      },
      attachments: {
        select: {
          id: true,
          category: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          uploadedById: true,
          createdAt: true,
        },
      },
      approvalSteps: {
        include: { decisions: true },
      },
      approvalDecisions: true,
      auditLogs: true,
    },
  });
}

export async function updateContract(
  formId: string,
  user: AuthUser,
  input: ContractDraftInput
) {
  await getEditableForm(formId, user);

  if (Object.prototype.hasOwnProperty.call(input, 'recommendedVendorId')) {
    await validateRecommendedVendor(
      formId,
      input.recommendedVendorId
    );
  }

  return prisma.contractForm.update({
    where: { id: formId },
    data: {
      ...input,
      ...(Object.prototype.hasOwnProperty.call(input, 'contractAmount')
        ? { contractAmount: decimal(input.contractAmount) }
        : {}),
    },
  });
}

export async function listBidders(formId: string, user: AuthUser) {
  await getAccessibleForm(formId, user);

  return prisma.bidder.findMany({
    where: { contractFormId: formId },
    orderBy: { sortOrder: 'asc' },
    include: {
      vendor: true,
      quotations: true,
    },
  });
}

export async function createBidder(
  formId: string,
  user: AuthUser,
  input: { vendorId: string; sortOrder: number }
) {
  await getEditableForm(formId, user);

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
  });

  if (!vendor) {
    throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
  }

  return prisma.$transaction(async (tx) =>
    tx.bidder.create({
      data: {
        ...input,
        contractFormId: formId,
      },
      include: { vendor: true },
    })
  );
}

export async function updateBidder(
  formId: string,
  bidderId: string,
  user: AuthUser,
  input: Partial<{ vendorId: string; sortOrder: number }>
) {
  const form = await getEditableForm(formId, user);

  const bidder = await prisma.bidder.findFirst({
    where: {
      id: bidderId,
      contractFormId: formId,
    },
  });

  if (!bidder) {
    throw new AppError(404, 'BIDDER_NOT_FOUND', 'Bidder not found');
  }

  if (input.vendorId && input.vendorId !== bidder.vendorId) {
    if (form.recommendedVendorId === bidder.vendorId) {
      throw new AppError(
        409,
        'RECOMMENDED_VENDOR_BIDDER_CONFLICT',
        'Cannot change the bidder vendor while it is the contract recommended vendor'
      );
    }

    if (
      !(await prisma.vendor.findUnique({
        where: { id: input.vendorId },
      }))
    ) {
      throw new AppError(404, 'VENDOR_NOT_FOUND', 'Vendor not found');
    }
  }

  return prisma.$transaction(async (tx) =>
    tx.bidder.update({
      where: { id: bidderId },
      data: input,
      include: { vendor: true },
    })
  );
}

export async function deleteBidder(
  formId: string,
  bidderId: string,
  user: AuthUser
) {
  const form = await getEditableForm(formId, user);

  const bidder = await prisma.bidder.findFirst({
    where: {
      id: bidderId,
      contractFormId: formId,
    },
  });

  if (!bidder) {
    throw new AppError(404, 'BIDDER_NOT_FOUND', 'Bidder not found');
  }

  if (form.recommendedVendorId === bidder.vendorId) {
    throw new AppError(
      409,
      'RECOMMENDED_VENDOR_BIDDER_CONFLICT',
      'Cannot delete the bidder for the contract recommended vendor'
    );
  }

  const evaluation = await prisma.evaluation.findFirst({
    where: {
      bidderId,
      contractFormId: formId,
    },
    select: { id: true },
  });

  if (evaluation) {
    throw new AppError(
      409,
      'BIDDER_HAS_EVALUATIONS',
      'Cannot delete a bidder with evaluation records'
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.quotation.deleteMany({
      where: { bidderId },
    });

    return tx.bidder.delete({
      where: { id: bidderId },
    });
  });
}

export async function listQuotations(
  formId: string,
  bidderId: string,
  user: AuthUser
) {
  await getAccessibleForm(formId, user);

  const bidder = await prisma.bidder.findFirst({
    where: {
      id: bidderId,
      contractFormId: formId,
    },
  });

  if (!bidder) {
    throw new AppError(404, 'BIDDER_NOT_FOUND', 'Bidder not found');
  }

  return prisma.quotation.findMany({
    where: { bidderId },
    include: { currency: true },
  });
}

export async function createQuotation(
  formId: string,
  bidderId: string,
  user: AuthUser,
  input: {
    quotedAmount: string;
    currencyId?: string | null;
    quotationDate?: Date | null;
    notes?: string | null;
  }
) {
  await getEditableForm(formId, user);

  const bidder = await prisma.bidder.findFirst({
    where: {
      id: bidderId,
      contractFormId: formId,
    },
  });

  if (!bidder) {
    throw new AppError(404, 'BIDDER_NOT_FOUND', 'Bidder not found');
  }

  if (
    input.currencyId &&
    !(await prisma.currency.findUnique({
      where: { id: input.currencyId },
    }))
  ) {
    throw new AppError(404, 'CURRENCY_NOT_FOUND', 'Currency not found');
  }

  return prisma.$transaction(async (tx) =>
    tx.quotation.create({
      data: {
        ...input,
        quotedAmount: new Prisma.Decimal(input.quotedAmount),
        bidderId,
      },
      include: { currency: true },
    })
  );
}

export async function updateQuotation(
  formId: string,
  bidderId: string,
  quotationId: string,
  user: AuthUser,
  input: Partial<{
    quotedAmount: string;
    currencyId?: string | null;
    quotationDate?: Date | null;
    notes?: string | null;
  }>
) {
  await getEditableForm(formId, user);

  const quotation = await prisma.quotation.findFirst({
    where: {
      id: quotationId,
      bidderId,
      bidder: {
        contractFormId: formId,
      },
    },
  });

  if (!quotation) {
    throw new AppError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  }

  if (
    input.currencyId !== undefined &&
    input.currencyId !== null &&
    !(await prisma.currency.findUnique({
      where: { id: input.currencyId },
    }))
  ) {
    throw new AppError(404, 'CURRENCY_NOT_FOUND', 'Currency not found');
  }

  return prisma.$transaction(async (tx) =>
    tx.quotation.update({
      where: { id: quotationId },
      data: {
        ...input,
        ...(input.quotedAmount
          ? {
            quotedAmount: new Prisma.Decimal(input.quotedAmount),
          }
          : {}),
      },
      include: { currency: true },
    })
  );
}

export async function deleteQuotation(
  formId: string,
  bidderId: string,
  quotationId: string,
  user: AuthUser
) {
  await getEditableForm(formId, user);

  const quotation = await prisma.quotation.findFirst({
    where: {
      id: quotationId,
      bidderId,
      bidder: {
        contractFormId: formId,
      },
    },
  });

  if (!quotation) {
    throw new AppError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
  }

  return prisma.$transaction(async (tx) =>
    tx.quotation.delete({
      where: { id: quotationId },
    })
  );
}

export async function listCostLines(formId: string, user: AuthUser) {
  await getAccessibleForm(formId, user);

  return prisma.costLine.findMany({
    where: { contractFormId: formId },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createCostLine(
  formId: string,
  user: AuthUser,
  input: {
    description: string;
    quantity?: string | null;
    unitCost?: string | null;
    amount: string;
    sortOrder: number;
  }
) {
  await getEditableForm(formId, user);

  return prisma.$transaction(async (tx) =>
    tx.costLine.create({
      data: {
        ...input,
        contractFormId: formId,
        quantity: decimal(input.quantity),
        unitCost: decimal(input.unitCost),
        amount: new Prisma.Decimal(input.amount),
      },
    })
  );
}

export async function updateCostLine(
  formId: string,
  lineId: string,
  user: AuthUser,
  input: Partial<{
    description: string;
    quantity?: string | null;
    unitCost?: string | null;
    amount: string;
    sortOrder: number;
  }>
) {
  await getEditableForm(formId, user);

  const line = await prisma.costLine.findFirst({
    where: {
      id: lineId,
      contractFormId: formId,
    },
  });

  if (!line) {
    throw new AppError(404, 'COST_LINE_NOT_FOUND', 'Cost line not found');
  }

  return prisma.$transaction(async (tx) =>
    tx.costLine.update({
      where: { id: lineId },
      data: {
        ...input,
        ...(input.quantity !== undefined
          ? { quantity: decimal(input.quantity) }
          : {}),
        ...(input.unitCost !== undefined
          ? { unitCost: decimal(input.unitCost) }
          : {}),
        ...(input.amount !== undefined
          ? { amount: new Prisma.Decimal(input.amount) }
          : {}),
      },
    })
  );
}

export async function deleteCostLine(
  formId: string,
  lineId: string,
  user: AuthUser
) {
  await getEditableForm(formId, user);

  const line = await prisma.costLine.findFirst({
    where: {
      id: lineId,
      contractFormId: formId,
    },
  });

  if (!line) {
    throw new AppError(404, 'COST_LINE_NOT_FOUND', 'Cost line not found');
  }

  return prisma.$transaction(async (tx) =>
    tx.costLine.delete({
      where: { id: lineId },
    })
  );
}

// Submit contract (creation or resubmission)
export async function submitContract(
  formId: string,
  user: AuthUser,
  approverIds: string[]
) {
  // Validate approver IDs BEFORE any Prisma calls.
  let validatedApproverIds: string[];

  try {
    const validation = initializeWorkflowSchema.parse({
      approverIds,
    });

    validatedApproverIds = validation.approverIds;
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid approverIds',
        (error as { issues: unknown[] }).issues
      );
    }

    throw error;
  }

  // Ensure the user is authenticated.
  assertAuthenticated(user);

  // Load contract and verify creator and status.
  const form = await prisma.contractForm.findUnique({
    where: { id: formId },
  });

  if (!form) {
    throw new AppError(
      404,
      'FORM_NOT_FOUND',
      'Contract form not found'
    );
  }

  if (form.createdById !== user.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the contract creator can submit or resubmit'
    );
  }

  if (!editableStatuses.includes(form.status)) {
    throw new AppError(
      409,
      'INVALID_STATE',
      'Only draft or returned contracts can be submitted'
    );
  }

  // Transaction: update contract and initialize approval workflow.
  return prisma.$transaction(async (tx) => {
    // Initialize or reset the approval workflow.
    // This also updates the contract status to PENDING_APPROVAL.
    await initializeOrResetApprovalWorkflow(
      formId,
      validatedApproverIds,
      user.id,
      tx
    );

    // Audit log entry.
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action:
          form.status === ContractStatus.RETURNED
            ? 'CONTRACT_RESUBMITTED'
            : 'CONTRACT_SUBMITTED',
        entityType: 'ContractForm',
        entityId: formId,
        contractFormId: formId,
        details: {
          previousStatus: form.status,
          newStatus: ContractStatus.PENDING_APPROVAL,
          approvers: validatedApproverIds,
        },
      },
    });

    // Return updated form.
    return tx.contractForm.findUnique({
      where: { id: formId },
    });
  });
}
