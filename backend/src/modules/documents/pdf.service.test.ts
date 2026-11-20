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
    createdAt: new Date('2026-10-25T10:00:00Z'),
    updatedAt: new Date('2026-11-05T09:30:00Z'),
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
    evaluations: [
      { type: 'TECHNICAL', score: d('8.5000'), remarks: 'Good', bidder: { companyName: 'Acme Ltd' } },
      { type: 'COMMERCIAL', score: d('9.0000'), remarks: 'Competitive price', bidder: { companyName: 'Acme Ltd' } },
    ],
    costLines: [
      { description: 'Chair', quantity: d('10.0000'), unitCost: d('100.0000'), amount: d('1000.0000') },
      { description: 'Delivery', quantity: null, unitCost: null, amount: d('200.5000') },
    ],
    attachments: [{
      fileName: 'quotation.pdf',
      category: 'SUPPORTING',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      createdAt: new Date('2026-10-26T10:00:00Z'),
    }],
    auditLogs: [{
      action: 'CONTRACT_FINAL_APPROVED',
      entityType: 'ContractForm',
      createdAt: new Date('2026-11-05T09:30:00Z'),
      actor: { fullName: 'Ann Approver' },
    }],
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

  it('renders each required section with separate evaluations, documents, and audit records', () => {
    const json = JSON.stringify(buildDocDefinition(source).content);
    for (const section of [
      '1. Contract / Project Identification',
      '2. Sponsor Department',
      '3. Contract Category and Scope',
      '4. Procurement / Sourcing Rationale',
      '5. Vendor / Contractor Details',
      '6. Contract Amount and Currency',
      '7. Budget and Cost Estimate',
      '8. Bidders and Quotations',
      '9. Technical Evaluation',
      '10. Commercial Evaluation',
      '11. Recommended Vendor and Selection Rationale',
      '12. Supporting Documents',
      '13. Approval History',
      '14. Audit / Record Information',
    ]) {
      expect(json).toContain(section);
    }
    expect(json).toContain('quotation.pdf');
    expect(json).toContain('CONTRACT_FINAL_APPROVED');
    expect(json).toContain('Competitive price');
  });

  it('generates a valid multi-page PDF for long bidder and audit tables', async () => {
    const longText = 'Supporting details '.repeat(80);
    const pdf = await generateFinalContractPdf({
      ...source,
      form: {
        ...source.form,
        bidders: Array.from({ length: 60 }, (_, index) => ({
          ...source.form.bidders[0],
          companyName: `Bidder ${index + 1}`,
          qualifications: longText,
          quotations: source.form.bidders[0].quotations,
        })),
        auditLogs: Array.from({ length: 80 }, (_, index) => ({
          action: `AUDIT_ACTION_${index + 1}`,
          entityType: 'ContractForm',
          createdAt: new Date(`2026-11-${String((index % 28) + 1).padStart(2, '0')}T09:30:00Z`),
        })),
      },
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5000);
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0).toBeGreaterThan(1);
  }, 15_000);
});
