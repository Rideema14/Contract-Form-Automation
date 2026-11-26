import { describe, expect, it } from 'vitest';
import {
  assertShowcaseSubmitterApproval,
  assertShowcaseTwoLevelRejection,
  buildShowcaseDynamicValues,
  showcaseCostAmount,
} from './utils/showcase-seed';

describe('showcase seed helpers', () => {
  it('generates schema-compatible values for every supported field type', () => {
    const fields = [
      { id: '00000000-0000-4000-8000-000000000001', label: 'Text', type: 'SHORT_TEXT' as const, required: true, defaultValue: null, options: [] },
      { id: '00000000-0000-4000-8000-000000000002', label: 'Details', type: 'LONG_TEXT' as const, required: true, defaultValue: null, options: [] },
      { id: '00000000-0000-4000-8000-000000000003', label: 'Amount', type: 'NUMBER' as const, required: true, defaultValue: null, options: [] },
      { id: '00000000-0000-4000-8000-000000000004', label: 'Email', type: 'EMAIL' as const, required: true, defaultValue: null, options: [] },
      { id: '00000000-0000-4000-8000-000000000005', label: 'Date', type: 'DATE' as const, required: true, defaultValue: null, options: [] },
      { id: '00000000-0000-4000-8000-000000000006', label: 'Method', type: 'DROPDOWN' as const, required: true, defaultValue: null, options: ['Competitive', 'Sole source'] },
      { id: '00000000-0000-4000-8000-000000000007', label: 'Regions', type: 'MULTI_SELECT' as const, required: true, defaultValue: null, options: ['North', 'South'] },
      { id: '00000000-0000-4000-8000-000000000008', label: 'Priority', type: 'RADIO' as const, required: true, defaultValue: null, options: ['Standard', 'Urgent'] },
      { id: '00000000-0000-4000-8000-000000000009', label: 'Approved', type: 'CHECKBOX' as const, required: true, defaultValue: null, options: [] },
    ];
    const values = buildShowcaseDynamicValues({ sections: [{ fields }] }, 0);
    expect(values[fields[3].id]).toMatch(/@example\.com$/);
    expect(values[fields[5].id]).toBe('Competitive');
    expect(values[fields[6].id]).toEqual(['North', 'South']);
    expect(values[fields[8].id]).toBe(true);
  });

  it('calculates cost line amounts without decimal drift', () => {
    expect(showcaseCostAmount('40', '1250.0000').toFixed()).toBe('50000');
    expect(showcaseCostAmount('0.5', '125.25').toFixed()).toBe('62.625');
  });

  it('accepts a service-consistent Level 1 approval followed by Level 2 rejection', () => {
    const levelOneAt = new Date('2026-11-24T12:00:00Z');
    const levelTwoAt = new Date('2026-11-25T12:00:00Z');
    expect(() => assertShowcaseTwoLevelRejection({
      status: 'REJECTED',
      approvalSteps: [
        { id: 'step-1', level: 1, status: 'APPROVED', approverId: 'approver-1', actedAt: levelOneAt },
        { id: 'step-2', level: 2, status: 'REJECTED', approverId: 'approver-2', actedAt: levelTwoAt },
      ],
      decisions: [
        { approvalStepId: 'step-1', actorId: 'approver-1', decision: 'APPROVED', comment: 'Technical review approved.', createdAt: levelOneAt },
        { approvalStepId: 'step-2', actorId: 'approver-2', decision: 'REJECTED', comment: 'Commercial terms exceed the ceiling.', createdAt: levelTwoAt },
      ],
    })).not.toThrow();
  });

  it('rejects inconsistent two-level approval history', () => {
    const when = new Date('2026-11-25T12:00:00Z');
    expect(() => assertShowcaseTwoLevelRejection({
      status: 'REJECTED',
      approvalSteps: [
        { id: 'step-1', level: 1, status: 'WAITING', approverId: 'same-approver', actedAt: null },
        { id: 'step-2', level: 2, status: 'REJECTED', approverId: 'same-approver', actedAt: when },
      ],
      decisions: [
        { approvalStepId: 'step-2', actorId: 'same-approver', decision: 'REJECTED', comment: 'Rejected.', createdAt: when },
      ],
    })).toThrow(/inconsistent/);
  });

  it('requires the submitted showcase contract to be pending for the original demo approver', () => {
    expect(() => assertShowcaseSubmitterApproval({
      status: 'PENDING_APPROVAL',
      createdByEmail: 'submitter@example.com',
      approvalSteps: [
        { level: 1, status: 'PENDING', approverEmail: 'approver@example.com' },
        { level: 2, status: 'WAITING', approverEmail: 'jordan.blake.showcase@example.com' },
      ],
    })).not.toThrow();
    expect(() => assertShowcaseSubmitterApproval({
      status: 'PENDING_APPROVAL',
      createdByEmail: 'submitter@example.com',
      approvalSteps: [{ level: 1, status: 'PENDING', approverEmail: 'someone-else@example.com' }],
    })).toThrow(/demo approver/);
  });
});
