import { AppError } from '../../utils/app-error';

export interface AccessUser {
  id: string;
  role: string;
}

/** Minimal Prisma surface needed, so the rule can be tested without a database. */
export interface AccessDb {
  contractForm: {
    findUnique(args: { where: { id: string }; select: { createdById: true } }): Promise<{ createdById: string } | null>;
  };
  approvalStep: {
    findFirst(args: { where: { contractFormId: string; approverId: string } }): Promise<unknown | null>;
  };
}

/**
 * TEMPORARY: same rule as getAccessibleForm in contract.service.ts (admin, creator,
 * or an approver assigned to a step). Replace this with Member 1's exported
 * assertCanViewAttachments() as soon as it exists, so there is one rule only.
 */
export function createViewAccessCheck(db: AccessDb) {
  return async function assertCanViewAttachments(formId: string, user: AccessUser): Promise<void> {
    const form = await db.contractForm.findUnique({ where: { id: formId }, select: { createdById: true } });
    if (!form) throw new AppError(404, 'FORM_NOT_FOUND', 'Contract form not found');
    if (user.role === 'ADMIN' || form.createdById === user.id) return;
    if (
      user.role === 'APPROVER' &&
      (await db.approvalStep.findFirst({ where: { contractFormId: formId, approverId: user.id } }))
    ) {
      return;
    }
    throw new AppError(403, 'FORBIDDEN', 'You are not authorized to access this contract');
  };
}
