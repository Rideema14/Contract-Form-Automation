import { describe, it, expect } from 'vitest';
import { buildDocDefinition, generateFinalContractPdf, FinalPdfSource } from './pdf.service';

const d = (v: string) => ({ toString: () => v });

const source: FinalPdfSource = {
  form: {
    id: 'f1',
    referenceNo: 'CF-0001',
    title: 'Office chairs',
    status: 'APPROVED',
    scope: 'Supply 10 chairs',
    procurementRationale: 'Replace old chairs',
    selectionRationale: 'Lowest compliant bid',
    contractAmount: d('1200.5000'),
    submittedAt: new Date('2026-11-01T10:00:00Z'),
    createdBy: { fullName: 'Sam Submitter' },
    sponsorDepartment: { name: 'Operations' },
    contractCategory: { name: 'Goods' },
    currency: { code: 'USD' },
    recommendedVendor: { name: 'Acme Ltd' },
    recommendedBidder: { companyName: 'Acme Ltd' },
    bidders: [
      {
        companyName: 'Acme Ltd', contactPerson: 'A. Person', email: 'a@acme.test', phone: null,
        qualifications: 'ISO 9001', vendor: { name: 'Acme Ltd' },
        quotations: [{ quotedAmount: d('1200.5000'), currency: { code: 'USD' }, quotationDate: new Date('2026-10-20'), notes: null }],
      },
    ],
    evaluations: [{ type: 'TECHNICAL', score: d('8.5000'), remarks: 'Good', bidder: { companyName: 'Acme Ltd' } }],
    costLines: [
      { description: 'Chair', quantity: d('10.0000'), unitCost: d('100.0000'), amount: d('1000.0000') },
      { description: 'Delivery', quantity: null, unitCost: null, amount: d('200.5000') },
    ],
  },
  history: {
    approvalSteps: [{ id: 's1', level: 1, approver: { fullName: 'Ann Approver' } }],
    decisions: [{ approvalStepId: 's1', decision: 'APPROVED', comment: 'OK', createdAt: new Date('2026-11-05T09:30:00Z'), actor: { fullName: 'Ann Approver' } }],
  },
  generatedAt: new Date('2026-11-06T00:00:00Z'),
};

describe('final contract PDF', () => {
  it('produces a valid PDF buffer', async () => {
    const pdf = await generateFinalContractPdf(source);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1500);
  });

  it('handles a form with nothing optional filled in', async () => {
    const pdf = await generateFinalContractPdf({
      ...source,
      form: {
        ...source.form, referenceNo: null, title: null, scope: null, procurementRationale: null,
        selectionRationale: null, contractAmount: null, submittedAt: null, createdBy: null,
        sponsorDepartment: null, contractCategory: null, currency: null, recommendedVendor: null,
        recommendedBidder: null, bidders: [], evaluations: [], costLines: [],
      },
      history: { approvalSteps: [], decisions: [] },
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('uses decimal-safe totals and shows the approval history', () => {
    const json = JSON.stringify(buildDocDefinition(source).content);
    expect(json).toContain('Total: 1200.50 USD'); // 1000.00 + 200.50 added exactly
    expect(json).toContain('Ann Approver');
    expect(json).toContain('2026-11-05 09:30 UTC');
  });
});
