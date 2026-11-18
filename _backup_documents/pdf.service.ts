import path from 'node:path';
import pdfmake from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { formatMoney, sumMoney } from './money';

type Dec = { toString(): string };

/**
 * Input = what contractService.getContract() and approvalService.getApprovalHistory()
 * already return (structural types, so no extra queries are needed).
 * The 14-section layout is NOT final: the company has not confirmed the exact
 * sections (CL-01/09). Change buildDocDefinition in this one place when it does.
 */
export interface FinalPdfSource {
  form: {
    id: string;
    referenceNo: string | null;
    title: string | null;
    status: string;
    scope: string | null;
    procurementRationale: string | null;
    selectionRationale: string | null;
    contractAmount: Dec | null;
    submittedAt: Date | null;
    createdBy?: { fullName: string } | null;
    sponsorDepartment?: { name: string } | null;
    contractCategory?: { name: string } | null;
    currency?: { code: string } | null;
    recommendedVendor?: { name: string } | null;
    recommendedBidder?: { companyName: string } | null;
    bidders: Array<{
      companyName: string;
      contactPerson: string | null;
      email: string | null;
      phone: string | null;
      qualifications: string | null;
      vendor?: { name: string } | null;
      quotations: Array<{
        quotedAmount: Dec;
        currency?: { code: string } | null;
        quotationDate: Date | null;
        notes: string | null;
      }>;
    }>;
    evaluations: Array<{
      type: string;
      score: Dec | null;
      remarks: string | null;
      bidder?: { companyName: string } | null;
    }>;
    costLines: Array<{ description: string; quantity: Dec | null; unitCost: Dec | null; amount: Dec }>;
  };
  history: {
    approvalSteps: Array<{ id: string; level: number; approver?: { fullName: string } | null }>;
    decisions: Array<{
      approvalStepId: string;
      decision: string;
      comment: string | null;
      createdAt: Date;
      actor?: { fullName: string } | null;
    }>;
  };
  generatedAt: Date;
}

const fontDir = path.join(path.dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');
pdfmake.addFonts({
  Roboto: {
    normal: path.join(fontDir, 'Roboto-Regular.ttf'),
    bold: path.join(fontDir, 'Roboto-Medium.ttf'),
    italics: path.join(fontDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontDir, 'Roboto-MediumItalic.ttf'),
  },
});

const text = (v: string | null | undefined): string => (v && v.trim() !== '' ? v : '-');
const money = (v: Dec | null | undefined, decimals = 2): string => (v == null ? '-' : formatMoney(v.toString(), decimals));
const stamp = (d: Date | null | undefined): string => (d ? d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '-');
const day = (d: Date | null | undefined): string => (d ? d.toISOString().slice(0, 10) : '-');

function heading(label: string): Content {
  return { text: label, fontSize: 13, bold: true, margin: [0, 10, 0, 4] };
}

function table(headers: string[], rows: string[][], widths: Array<string | number>): Content {
  if (rows.length === 0) return { text: 'None recorded', italics: true, margin: [0, 0, 0, 6] };
  return {
    table: {
      headerRows: 1,
      widths,
      body: [headers.map((h) => ({ text: h, bold: true, fillColor: '#eeeeee' })), ...rows],
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 6],
  };
}

export function buildDocDefinition(src: FinalPdfSource): TDocumentDefinitions {
  const { form, history } = src;
  const ref = form.referenceNo ?? form.id;
  const currency = form.currency?.code ?? '';

  const stepById = new Map(history.approvalSteps.map((s) => [s.id, s]));
  const decisions = [...history.decisions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const costTotal = sumMoney(form.costLines.map((c) => c.amount.toString()));

  return {
    info: { title: `${ref} - ${form.title ?? 'Contract form'}` },
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [40, 50, 40, 50],
    footer: (page, pages) => ({
      text: `${ref}  |  Generated ${stamp(src.generatedAt)}  |  Page ${page} of ${pages}`,
      alignment: 'center',
      fontSize: 8,
      margin: [0, 10, 0, 0],
    }),
    content: [
      { text: 'Contract Form', fontSize: 18, bold: true },
      { text: `${ref} - ${text(form.title)}`, fontSize: 12, margin: [0, 2, 0, 6] },

      heading('Project identification'),
      table(
        ['Field', 'Value'],
        [
          ['Reference number', text(form.referenceNo)],
          ['Sponsor department', text(form.sponsorDepartment?.name)],
          ['Contract category', text(form.contractCategory?.name)],
          ['Submitted by', text(form.createdBy?.fullName)],
          ['Submitted at', stamp(form.submittedAt)],
          ['Status', form.status],
        ],
        ['35%', '*']
      ),

      heading('Scope of work'),
      { text: text(form.scope), margin: [0, 0, 0, 4] },
      heading('Procurement rationale'),
      { text: text(form.procurementRationale), margin: [0, 0, 0, 4] },

      heading('Contract value and recommendation'),
      table(
        ['Field', 'Value'],
        [
          ['Contract amount', form.contractAmount == null ? '-' : `${money(form.contractAmount)} ${currency}`.trim()],
          ['Recommended vendor', text(form.recommendedVendor?.name)],
          ['Recommended bidder', text(form.recommendedBidder?.companyName)],
          ['Selection rationale', text(form.selectionRationale)],
        ],
        ['35%', '*']
      ),

      heading('Bidders'),
      table(
        ['Company', 'Contact', 'Qualifications'],
        form.bidders.map((b) => [
          text(b.companyName),
          [b.contactPerson, b.email, b.phone].filter(Boolean).join(', ') || '-',
          text(b.qualifications),
        ]),
        ['*', '*', '*']
      ),

      heading('Quotations'),
      table(
        ['Bidder', 'Quoted amount', 'Date', 'Notes'],
        form.bidders.flatMap((b) =>
          b.quotations.map((q) => [
            text(b.companyName),
            `${money(q.quotedAmount)} ${q.currency?.code ?? ''}`.trim(),
            day(q.quotationDate),
            text(q.notes),
          ])
        ),
        ['*', 'auto', 'auto', '*']
      ),

      heading('Technical and commercial evaluation'),
      table(
        ['Bidder', 'Type', 'Score', 'Remarks'],
        form.evaluations.map((e) => [text(e.bidder?.companyName), e.type, money(e.score, 2), text(e.remarks)]),
        ['*', 'auto', 'auto', '*']
      ),

      heading('Cost estimate'),
      table(
        ['Description', 'Quantity', 'Unit cost', 'Amount'],
        form.costLines.map((c) => [text(c.description), money(c.quantity, 2), money(c.unitCost, 2), money(c.amount)]),
        ['*', 'auto', 'auto', 'auto']
      ),
      { text: `Total: ${costTotal} ${currency}`.trim(), bold: true, alignment: 'right', margin: [0, 0, 0, 6] },

      heading('Approval history'),
      table(
        ['Level', 'Approver', 'Decision', 'Comment', 'Date'],
        decisions.map((d) => [
          String(stepById.get(d.approvalStepId)?.level ?? '-'),
          text(d.actor?.fullName ?? stepById.get(d.approvalStepId)?.approver?.fullName),
          d.decision,
          text(d.comment),
          stamp(d.createdAt),
        ]),
        ['auto', '*', 'auto', '*', 'auto']
      ),
    ],
  };
}

export async function generateFinalContractPdf(src: FinalPdfSource): Promise<Buffer> {
  return pdfmake.createPdf(buildDocDefinition(src)).getBuffer();
}
