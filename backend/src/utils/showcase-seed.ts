import { Prisma } from '@prisma/client';

export type ShowcaseDynamicField = {
  id: string;
  label: string;
  type: 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER' | 'EMAIL' | 'DATE' | 'DROPDOWN' | 'MULTI_SELECT' | 'RADIO' | 'CHECKBOX';
  required: boolean;
  defaultValue: string | boolean | string[] | null;
  options: string[];
};

function fallbackFieldValue(field: ShowcaseDynamicField, contractIndex: number): string {
  switch (field.type) {
    case 'NUMBER':
      return String(1 + contractIndex);
    case 'EMAIL':
      return `procurement.contract${contractIndex + 1}@example.com`;
    case 'DATE':
      return `2026-11-${String(10 + contractIndex).padStart(2, '0')}`;
    case 'LONG_TEXT':
      return 'Approved procurement process with documented technical, commercial and compliance considerations.';
    default:
      return `Showcase contract requirement ${contractIndex + 1}`;
  }
}

export function buildShowcaseDynamicValues(
  definition: { sections: Array<{ fields: ShowcaseDynamicField[] }> },
  contractIndex: number,
): Record<string, string | boolean | string[]> {
  const values: Record<string, string | boolean | string[]> = {};
  for (const section of definition.sections) {
    for (const field of section.fields) {
      if (field.type === 'CHECKBOX') {
        values[field.id] = field.required
          ? true
          : (typeof field.defaultValue === 'boolean' ? field.defaultValue : true);
      } else if (field.type === 'MULTI_SELECT') {
        values[field.id] = Array.isArray(field.defaultValue) && field.defaultValue.length
          ? field.defaultValue
          : field.options.slice(0, Math.min(2, field.options.length));
      } else if (field.type === 'DROPDOWN' || field.type === 'RADIO') {
        values[field.id] = typeof field.defaultValue === 'string' && field.defaultValue
          ? field.defaultValue
          : (field.options[contractIndex % Math.max(1, field.options.length)] ?? '');
      } else if (typeof field.defaultValue === 'string' && field.defaultValue) {
        values[field.id] =
          (field.type === 'EMAIL' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.defaultValue))
          || (field.type === 'DATE' && /^\d{4}-\d{2}-\d{2}$/.test(field.defaultValue))
          || (field.type === 'NUMBER' && /^-?\d+(?:\.\d+)?$/.test(field.defaultValue))
          || field.type === 'SHORT_TEXT'
          || field.type === 'LONG_TEXT'
            ? field.defaultValue
            : fallbackFieldValue(field, contractIndex);
      } else {
        values[field.id] = fallbackFieldValue(field, contractIndex);
      }
    }
  }
  return values;
}

export function showcaseCostAmount(quantity: string, unitCost: string): Prisma.Decimal {
  return new Prisma.Decimal(quantity).mul(new Prisma.Decimal(unitCost));
}

export interface ShowcaseRejectionHistory {
  status: string;
  approvalSteps: Array<{
    id: string;
    level: number;
    status: string;
    approverId: string;
    actedAt: Date | null;
  }>;
  decisions: Array<{
    approvalStepId: string;
    actorId: string;
    decision: string;
    comment: string | null;
    createdAt: Date;
  }>;
}

export function assertShowcaseTwoLevelRejection(history: ShowcaseRejectionHistory): void {
  const [first, second] = history.approvalSteps;
  const firstDecision = first && history.decisions.find((decision) => decision.approvalStepId === first.id);
  const secondDecision = second && history.decisions.find((decision) => decision.approvalStepId === second.id);
  if (
    history.status !== 'REJECTED'
    || history.approvalSteps.length !== 2
    || first.level !== 1
    || first.status !== 'APPROVED'
    || !first.actedAt
    || !firstDecision
    || firstDecision.decision !== 'APPROVED'
    || firstDecision.actorId !== first.approverId
    || !firstDecision.comment?.trim()
    || firstDecision.createdAt.getTime() !== first.actedAt.getTime()
    || second.level !== 2
    || second.status !== 'REJECTED'
    || !second.actedAt
    || !secondDecision
    || secondDecision.decision !== 'REJECTED'
    || secondDecision.actorId !== second.approverId
    || !secondDecision.comment?.trim()
    || secondDecision.createdAt.getTime() !== second.actedAt.getTime()
    || first.approverId === second.approverId
    || history.decisions.length !== 2
  ) {
    throw new Error('Showcase Level 2 rejection history is inconsistent with sequential approval behavior.');
  }
}

export interface ShowcasePendingApproval {
  status: string;
  createdByEmail: string;
  approvalSteps: Array<{
    level: number;
    status: string;
    approverEmail: string;
  }>;
}

export function assertShowcaseSubmitterApproval(contract: ShowcasePendingApproval): void {
  const [first, ...later] = contract.approvalSteps;
  if (
    contract.status !== 'PENDING_APPROVAL'
    || contract.createdByEmail !== 'submitter@example.com'
    || !first
    || first.level !== 1
    || first.status !== 'PENDING'
    || first.approverEmail !== 'approver@example.com'
    || later.some((step, index) => step.level !== index + 2 || step.status !== 'WAITING')
    || new Set(contract.approvalSteps.map((step) => step.approverEmail)).size !== contract.approvalSteps.length
  ) {
    throw new Error('Showcase submitter approval contract is not assigned to the demo approver as expected.');
  }
}
