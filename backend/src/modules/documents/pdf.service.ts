import path from 'node:path';
import pdfmake from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { formatMoney, sumMoney } from './money';
import type { DynamicValues, FormSchemaDefinition } from '../../schemas/form-builder.schema';

type Dec = { toString(): string };

export interface FinalPdfSource {
  form: {
    id: string;
    referenceNo: string | null;
    title: string | null;
    status: string;
    scope: string | null;
    procurementRationale: string | null;
    selectionRationale: string | null;
    budgetProvision: Dec | null;
    contractAmount: Dec | null;
    taxAmount: Dec;
    submittedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: { fullName: string; email?: string } | null;
    sponsorDepartment?: { name: string } | null;
    contractCategory?: { name: string } | null;
    currency?: { code: string } | null;
    recommendedVendor?: {
      name: string;
      vendorType?: { name: string } | null;
    } | null;
    recommendedBidder?: { companyName: string } | null;
    bidders: Array<{
      companyName: string;
      contactPerson: string | null;
      email: string | null;
      phone: string | null;
      qualifications: string | null;
      vendor?: {
        name: string;
        vendorType?: { name: string } | null;
      } | null;
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
    costLines: Array<{
      description: string;
      quantity: Dec | null;
      unitCost: Dec | null;
      amount: Dec;
    }>;
    attachments?: Array<{
      fileName: string;
      category: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: Date;
    }>;
    auditLogs?: Array<{
      action: string;
      entityType: string;
      createdAt: Date;
      actor?: { fullName: string } | null;
    }>;
    dynamicValues?: DynamicValues;
    formSchemaVersion?: {
      version: number;
      definition: FormSchemaDefinition;
    } | null;
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

pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((file) => path.resolve(file).startsWith(fontDir + path.sep));

const text = (value: string | null | undefined): string =>
  value && value.trim() !== '' ? value : '-';
const money = (value: Dec | null | undefined, decimals = 2): string =>
  value == null ? '-' : formatMoney(value.toString(), decimals);
const stamp = (value: Date | null | undefined): string =>
  value ? value.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '-';
const day = (value: Date | null | undefined): string =>
  value ? value.toISOString().slice(0, 10) : '-';
const size = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.ceil(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

function heading(label: string): Content {
  return { text: label, fontSize: 13, bold: true, margin: [0, 10, 0, 4] };
}

function table(headers: string[], rows: string[][], widths: Array<string | number>): Content {
  if (rows.length === 0) return { text: 'None recorded', italics: true, margin: [0, 0, 0, 6] };
  return {
    table: {
      headerRows: 1,
      widths,
      body: [headers.map((header) => ({ text: header, bold: true, fillColor: '#eeeeee' })), ...rows],
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 6],
  };
}

export function buildDocDefinition(src: FinalPdfSource): TDocumentDefinitions {
  const { form, history } = src;
  const reference = form.referenceNo ?? form.id;
  const currency = form.currency?.code ?? '';
  const stepById = new Map(history.approvalSteps.map((step) => [step.id, step]));
  const decisions = [...history.decisions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const auditLogs = [...(form.auditLogs ?? [])].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const costTotal = sumMoney(form.costLines.map((line) => line.amount.toString()));
  const totalWithTax = sumMoney([
    ...form.costLines.map((line) => line.amount.toString()),
    form.taxAmount.toString(),
  ]);
  const additionalSections = form.formSchemaVersion?.definition.sections ?? [];
  const dynamicValues = form.dynamicValues ?? {};

  return {
    info: { title: `${reference} - ${form.title ?? 'Contract form'}` },
    defaultStyle: { font: 'Roboto', fontSize: 10 },
    pageMargins: [40, 50, 40, 50],
    footer: (page, pages) => ({
      text: `${reference}  |  Generated ${stamp(src.generatedAt)}  |  Page ${page} of ${pages}`,
      alignment: 'center',
      fontSize: 8,
      margin: [0, 10, 0, 0],
    }),
    content: [
      { text: 'Contract Form', fontSize: 18, bold: true },
      { text: `${reference} - ${text(form.title)}`, fontSize: 12, margin: [0, 2, 0, 6] },

      heading('1. Contract / Project Identification'),
      table(
        ['Field', 'Value'],
        [
          ['Reference number', text(form.referenceNo)],
          ['Project / contract title', text(form.title)],
          ['Submitted by', text(form.createdBy?.fullName)],
          ['Submitter email', text(form.createdBy?.email)],
          ['Submitted at', stamp(form.submittedAt)],
          ['Current status', form.status],
        ],
        ['35%', '*'],
      ),

      heading('2. Sponsor Department'),
      { text: text(form.sponsorDepartment?.name), margin: [0, 0, 0, 4] },

      heading('3. Contract Category and Scope'),
      table(
        ['Field', 'Value'],
        [
          ['Contract category', text(form.contractCategory?.name)],
          ['Scope of work', text(form.scope)],
        ],
        ['35%', '*'],
      ),

      heading('4. Procurement / Sourcing Rationale'),
      { text: text(form.procurementRationale), margin: [0, 0, 0, 4] },

      heading('5. Vendor / Contractor Details'),
      table(
        ['Vendor / contractor', 'Vendor type', 'Contact person', 'Email', 'Phone'],
        form.bidders.map((bidder) => [
          text(bidder.vendor?.name ?? bidder.companyName),
          text(bidder.vendor?.vendorType?.name),
          text(bidder.contactPerson),
          text(bidder.email),
          text(bidder.phone),
        ]),
        ['*', '*', '*', '*', '*'],
      ),

      heading('6. Contract Amount and Currency'),
      table(
        ['Field', 'Value'],
        [
          ['Budget provision', `${money(form.budgetProvision)} ${currency}`.trim()],
          ['Estimated contract amount', `${money(form.contractAmount)} ${currency}`.trim()],
        ],
        ['35%', '*'],
      ),

      heading('7. Budget and Cost Estimate'),
      table(
        ['Description', 'Quantity', 'Unit cost', 'Amount'],
        form.costLines.map((line) => [
          text(line.description),
          money(line.quantity, 2),
          money(line.unitCost, 2),
          money(line.amount),
        ]),
        ['*', 'auto', 'auto', 'auto'],
      ),
      {
        text: `Subtotal: ${costTotal} ${currency}\nTax amount: ${money(form.taxAmount)} ${currency}\nTotal including tax: ${totalWithTax} ${currency}`.trim(),
        bold: true,
        alignment: 'right',
        margin: [0, 0, 0, 6],
      },

      heading('8. Bidders and Quotations'),
      table(
        ['Bidder', 'Qualifications', 'Quoted amount', 'Quotation date', 'Notes'],
        form.bidders.flatMap((bidder) =>
          bidder.quotations.length
            ? bidder.quotations.map((quotation) => [
                text(bidder.companyName),
                text(bidder.qualifications),
                `${money(quotation.quotedAmount)} ${quotation.currency?.code ?? ''}`.trim(),
                day(quotation.quotationDate),
                text(quotation.notes),
              ])
            : [[text(bidder.companyName), text(bidder.qualifications), '-', '-', '-']],
        ),
        ['*', '*', 'auto', 'auto', '*'],
      ),

      heading('9. Technical Evaluation'),
      table(
        ['Bidder', 'Score', 'Remarks'],
        form.evaluations
          .filter((evaluation) => evaluation.type === 'TECHNICAL')
          .map((evaluation) => [
            text(evaluation.bidder?.companyName),
            money(evaluation.score, 2),
            text(evaluation.remarks),
          ]),
        ['*', 'auto', '*'],
      ),

      heading('10. Commercial Evaluation'),
      table(
        ['Bidder', 'Score', 'Remarks'],
        form.evaluations
          .filter((evaluation) => evaluation.type === 'COMMERCIAL')
          .map((evaluation) => [
            text(evaluation.bidder?.companyName),
            money(evaluation.score, 2),
            text(evaluation.remarks),
          ]),
        ['*', 'auto', '*'],
      ),

      heading('11. Recommended Vendor and Selection Rationale'),
      table(
        ['Field', 'Value'],
        [
          ['Recommended vendor', text(form.recommendedVendor?.name)],
          ['Recommended bidder', text(form.recommendedBidder?.companyName)],
          ['Selection rationale', text(form.selectionRationale)],
        ],
        ['35%', '*'],
      ),

      heading('12. Supporting Documents'),
      table(
        ['File name', 'Category', 'File type', 'Size', 'Uploaded'],
        (form.attachments ?? []).map((attachment) => [
          text(attachment.fileName),
          attachment.category,
          attachment.mimeType,
          size(attachment.sizeBytes),
          stamp(attachment.createdAt),
        ]),
        ['*', '*', '*', 'auto', 'auto'],
      ),

      heading('13. Approval History'),
      table(
        ['Level', 'Approver', 'Decision', 'Comment', 'Date'],
        decisions.map((decision) => [
          String(stepById.get(decision.approvalStepId)?.level ?? '-'),
          text(decision.actor?.fullName ?? stepById.get(decision.approvalStepId)?.approver?.fullName),
          decision.decision,
          text(decision.comment),
          stamp(decision.createdAt),
        ]),
        ['auto', '*', 'auto', '*', 'auto'],
      ),

      heading('14. Audit / Record Information'),
      table(
        ['Record', 'Value'],
        [
          ['Contract record ID', form.id],
          ['Created at', stamp(form.createdAt)],
          ['Last updated at', stamp(form.updatedAt)],
          ['PDF generated at', stamp(src.generatedAt)],
        ],
        ['35%', '*'],
      ),
      table(
        ['Audit action', 'Entity', 'Actor', 'Date'],
        auditLogs.map((entry) => [
          entry.action,
          entry.entityType,
          text(entry.actor?.fullName),
          stamp(entry.createdAt),
        ]),
        ['*', '*', '*', 'auto'],
      ),
      ...(additionalSections.length ? [
        heading(`Additional Contract Details (Form version ${form.formSchemaVersion?.version ?? '-'})`),
        ...additionalSections.flatMap((section) => [
          { text: section.title, bold: true, margin: [0, 4, 0, 3] } as Content,
          ...(section.description ? [{ text: section.description, italics: true, margin: [0, 0, 0, 3] } as Content] : []),
          table(
            ['Field', 'Value'],
            section.fields.map((field) => {
              const value = dynamicValues[field.id];
              const formatted = Array.isArray(value)
                ? value.join(', ')
                : typeof value === 'boolean'
                  ? value ? 'Yes' : 'No'
                  : value;
              return [field.label, text(formatted)];
            }),
            ['35%', '*'],
          ),
        ]),
      ] : []),
    ],
  };
}

export async function generateFinalContractPdf(src: FinalPdfSource): Promise<Buffer> {
  return pdfmake.createPdf(buildDocDefinition(src)).getBuffer();
}
