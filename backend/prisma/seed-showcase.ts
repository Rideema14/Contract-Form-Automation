import 'dotenv/config';
import { Prisma, PrismaClient, ContractStatus, ApprovalStatus, ApprovalDecisionValue, EvaluationType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildShowcaseDynamicValues, showcaseCostAmount, assertShowcaseSubmitterApproval, assertShowcaseTwoLevelRejection } from '../src/utils/showcase-seed';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { documentService, generateCurrentContractPdf } from '../src/modules/documents/documents.runtime';
import { DocumentConfigError, getDocumentUploadConfig } from '../src/modules/documents/document.config';
import { assertValidFile, FileValidationError } from '../src/modules/documents/file.validator';
import { buildContractDriveFolderName } from '../src/modules/documents/file.utils';

const prisma = new PrismaClient();

const DEMO_EMAILS = new Set([
  'admin@example.com',
  'approver@example.com',
  'submitter@example.com',
]);

const SHOWCASE_ID = {
  departments: ['b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002'],
  categories: ['c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003'],
  vendorTypes: ['d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003'],
  currency: 'e0000000-0000-4000-8000-000000000001',
  approvers: [
    'f0000000-0000-4000-8000-000000000001',
    'f0000000-0000-4000-8000-000000000002',
    'f0000000-0000-4000-8000-000000000003',
    'f0000000-0000-4000-8000-000000000004',
  ],
  vendors: [
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000006',
  ],
};

const MULTI_LEVEL_REJECTION_ID = '20000000-0000-4000-8000-000000000007';
const DEMO_APPROVER_PENDING_ID = '20000000-0000-4000-8000-000000000008';
const PDF_ATTACHMENT_ID = '20000000-0000-4000-8000-000000000009';

function targetDescription(urlText: string): string {
  try {
    const url = new URL(urlText);
    const database = url.pathname.replace(/^\//, '') || '(unspecified)';
    return `${url.protocol}//${url.hostname}:${url.port || 'default'}/${database}${url.searchParams.get('schema') ? `?schema=${url.searchParams.get('schema')}` : ''}`;
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

function assertSafeExecution(): void {
  if (process.env.ALLOW_SHOWCASE_SEED !== 'true') {
    throw new Error('Showcase seeding is disabled. Set ALLOW_SHOWCASE_SEED=true only for the intended database.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }
  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL is invalid.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must point to PostgreSQL.');
  }
  console.log(`Showcase seed target: ${targetDescription(process.env.DATABASE_URL)}`);
}

function driveIsConfigured(): boolean {
  const oauthConfigured = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
    && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
    && process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim()
  );
  const mode = process.env.GOOGLE_DRIVE_AUTH_MODE?.trim()
    || (oauthConfigured ? 'oauth' : 'service-account');
  if (mode === 'oauth') return oauthConfigured;
  if (mode === 'service-account') {
    const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    return Boolean(keyFile && existsSync(keyFile) && process.env.GOOGLE_DRIVE_FOLDER_ID?.trim());
  }
  throw new Error('GOOGLE_DRIVE_AUTH_MODE must be oauth or service-account.');
}

async function uploadPdfShowcaseAttachment(
  prismaClient: PrismaClient,
  submitterId: string,
): Promise<number> {
  if (process.env.SHOWCASE_SEED_UPLOAD_PDF === 'false') {
    console.log('Showcase PDF upload skipped by SHOWCASE_SEED_UPLOAD_PDF=false; upload a PDF through the contract UI to test manually.');
    return 0;
  }
  if (!driveIsConfigured()) {
    console.log('Google Drive is not configured; no attachment was created. Upload a PDF through the contract UI to test manually.');
    return 0;
  }

  const existing = await prismaClient.attachment.findFirst({
    where: {
      contractFormId: PDF_ATTACHMENT_ID,
      category: 'SUPPORTING',
      originalFileName: 'showcase-procurement-brief.pdf',
    },
    select: { id: true },
  });
  if (existing) return 1;

  const pdf = await generateCurrentContractPdf(PDF_ATTACHMENT_ID, {
    id: submitterId,
    role: 'SUBMITTER',
  });
  const file = {
    originalname: 'showcase-procurement-brief.pdf',
    mimetype: 'application/pdf',
    size: pdf.content.byteLength,
  };
  let uploadConfig;
  try {
    uploadConfig = getDocumentUploadConfig();
  } catch (error) {
    if (!(error instanceof DocumentConfigError)) throw error;
    console.log(`Google Drive is configured, but document upload policy is unavailable (${error.message}); no attachment was created.`);
    return 0;
  }
  try {
    assertValidFile(
      { originalName: file.originalname, mimeType: file.mimetype, size: file.size },
      uploadConfig,
    );
  } catch (error) {
    if (!(error instanceof FileValidationError)) throw error;
    console.log(`Google Drive is configured, but the sample PDF does not satisfy upload policy (${error.message}); no attachment was created.`);
    return 0;
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'contract-showcase-'));
  const tempPath = path.join(tempDir, file.originalname);
  try {
    await writeFile(tempPath, pdf.content, { flag: 'wx' });
    const records = await documentService.uploadAttachments({
      contractFormId: PDF_ATTACHMENT_ID,
      contractFolderName: buildContractDriveFolderName(
        PDF_ATTACHMENT_ID,
        'Procurement Attachment Demonstration',
        'CF-SHOW-0009',
      ),
      category: 'SUPPORTING',
      uploadedById: submitterId,
      files: [{ path: tempPath, originalname: file.originalname, mimetype: file.mimetype, size: file.size }],
      displayNames: ['Sample procurement brief (PDF)'],
    });
    if (records.length !== 1 || !records[0].driveFileId.trim()) {
      throw new Error('Google Drive did not return valid attachment metadata.');
    }
    console.log(`Uploaded genuine showcase PDF attachment (${records[0].fileName}).`);
    return records.length;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const contractTemplates = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    referenceNo: 'CF-SHOW-0001',
    title: 'Cloud Infrastructure Migration',
    status: ContractStatus.DRAFT,
    category: 'IT and Technology',
    department: 'Information Technology',
    amount: '485000.0000',
    budget: '520000.0000',
    tax: '0.0000',
    vendorType: 'Technology Services',
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    referenceNo: 'CF-SHOW-0002',
    title: 'Facilities Preventive Maintenance Services',
    status: ContractStatus.PENDING_APPROVAL,
    category: 'Facilities and Operations',
    department: 'Facilities',
    amount: '215000.0000',
    budget: '230000.0000',
    tax: '21500.0000',
    vendorType: 'Facilities Services',
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    referenceNo: 'CF-SHOW-0003',
    title: 'Enterprise Cybersecurity Advisory',
    status: ContractStatus.APPROVED,
    category: 'Professional Services',
    department: 'Information Security',
    amount: '780000.0000',
    budget: '850000.0000',
    tax: '78000.0000',
    vendorType: 'Technology Services',
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    referenceNo: 'CF-SHOW-0004',
    title: 'Fleet Vehicle Lease Program',
    status: ContractStatus.RETURNED,
    category: 'Fleet and Transportation',
    department: 'Administration',
    amount: '340000.0000',
    budget: '375000.0000',
    tax: '34000.0000',
    vendorType: 'Professional Services',
  },
  {
    id: '20000000-0000-4000-8000-000000000005',
    referenceNo: 'CF-SHOW-0005',
    title: 'Corporate Learning Platform',
    status: ContractStatus.REJECTED,
    category: 'Professional Services',
    department: 'Human Resources',
    amount: '920000.0000',
    budget: '850000.0000',
    tax: '92000.0000',
    vendorType: 'Technology Services',
  },
  {
    id: '20000000-0000-4000-8000-000000000006',
    referenceNo: 'CF-SHOW-0006',
    title: 'Regional Office Fit-Out',
    status: ContractStatus.PENDING_APPROVAL,
    category: 'Construction and Capital Works',
    department: 'Facilities',
    amount: '1250000.0000',
    budget: '1400000.0000',
    tax: '125000.0000',
    vendorType: 'Construction Services',
  },
  {
    id: MULTI_LEVEL_REJECTION_ID,
    referenceNo: 'CF-SHOW-0007',
    title: 'Regional Data Centre Resilience Upgrade',
    status: ContractStatus.REJECTED,
    category: 'IT and Technology',
    department: 'Information Technology',
    amount: '465000.0000',
    budget: '500000.0000',
    tax: '46500.0000',
    vendorType: 'Technology Services',
  },
  {
    id: DEMO_APPROVER_PENDING_ID,
    referenceNo: 'CF-SHOW-0008',
    title: 'Records Digitization and Secure Archive',
    status: ContractStatus.PENDING_APPROVAL,
    category: 'Professional Services',
    department: 'Administration',
    amount: '168000.0000',
    budget: '180000.0000',
    tax: '16800.0000',
    vendorType: 'Professional Services',
  },
  {
    id: PDF_ATTACHMENT_ID,
    referenceNo: 'CF-SHOW-0009',
    title: 'Procurement Attachment Demonstration',
    status: ContractStatus.DRAFT,
    category: 'Professional Services',
    department: 'Administration',
    amount: '96000.0000',
    budget: '105000.0000',
    tax: '9600.0000',
    vendorType: 'Professional Services',
  },
] as const;

async function seedShowcase(prismaClient: PrismaClient): Promise<Record<string, number>> {
  const demoUsers = await prismaClient.user.findMany({
    where: { email: { in: [...DEMO_EMAILS] } },
    select: {
      id: true,
      fullName: true,
      email: true,
      passwordHash: true,
      role: true,
      isActive: true,
      departmentId: true,
      createdAt: true,
    },
  });
  if (demoUsers.length !== DEMO_EMAILS.size) {
    const found = new Set(demoUsers.map((user) => user.email));
    const missing = [...DEMO_EMAILS].filter((email) => !found.has(email));
    throw new Error(`Required demo account(s) are missing: ${missing.join(', ')}`);
  }
  const demoUsersBefore = new Map(demoUsers.map((user) => [user.email, user]));
  const submitter = demoUsers.find((user) => user.email === 'submitter@example.com');
  const demoApprover = demoUsers.find((user) => user.email === 'approver@example.com');
  if (!submitter || submitter.role !== 'SUBMITTER' || !submitter.isActive) {
    throw new Error('The submitter@example.com demo account must remain active with role SUBMITTER.');
  }
  if (!demoApprover || demoApprover.role !== 'APPROVER' || !demoApprover.isActive) {
    throw new Error('The approver@example.com demo account must remain active with role APPROVER.');
  }

  const latestSchema = await prismaClient.formSchemaVersion.findFirst({ orderBy: { version: 'desc' } });
  if (!latestSchema) throw new Error('No published form schema exists.');
  const schemaDefinition = latestSchema.definition as unknown as Parameters<typeof buildShowcaseDynamicValues>[0];
  if (!Array.isArray(schemaDefinition.sections)) throw new Error('Latest published form schema has an invalid definition.');

  const departmentNames = ['Information Technology', 'Facilities', 'Information Security', 'Administration', 'Human Resources'];
  const departments = new Map<string, string>();
  for (let i = 0; i < departmentNames.length; i++) {
    const department = await prismaClient.department.upsert({
      where: { name: departmentNames[i] },
      update: {},
      create: { name: departmentNames[i] },
    });
    departments.set(department.name, department.id);
  }

  const categoryNames = ['IT and Technology', 'Facilities and Operations', 'Professional Services', 'Fleet and Transportation', 'Construction and Capital Works'];
  const categories = new Map<string, string>();
  for (let i = 0; i < categoryNames.length; i++) {
    const category = await prismaClient.contractCategory.upsert({
      where: { name: categoryNames[i] },
      update: {},
      create: { name: categoryNames[i] },
    });
    categories.set(category.name, category.id);
  }

  const vendorTypeNames = ['Technology Services', 'Facilities Services', 'Professional Services', 'Construction Services'];
  const vendorTypes = new Map<string, string>();
  for (let i = 0; i < vendorTypeNames.length; i++) {
    const vendorType = await prismaClient.vendorType.upsert({
      where: { name: vendorTypeNames[i] },
      update: {},
      create: { name: vendorTypeNames[i] },
    });
    vendorTypes.set(vendorType.name, vendorType.id);
  }

  const currency = await prismaClient.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { id: SHOWCASE_ID.currency, code: 'USD', name: 'United States Dollar' },
  });

  const approverNames = ['Jordan Blake', 'Morgan Chen', 'Taylor Singh', 'Casey Romero'];
  const approverEmails = ['jordan.blake.showcase@example.com', 'morgan.chen.showcase@example.com', 'taylor.singh.showcase@example.com', 'casey.romero.showcase@example.com'];
  const approvers: string[] = [];
  const showcaseApproverPasswordHash = await bcrypt.hash('Showcase-Only-Approver-Password!', 12);
  for (let i = 0; i < approverNames.length; i++) {
    if (DEMO_EMAILS.has(approverEmails[i])) {
      throw new Error(`Showcase approver email conflicts with a protected demo account: ${approverEmails[i]}`);
    }
    const user = await prismaClient.user.upsert({
      where: { email: approverEmails[i] },
      update: { fullName: approverNames[i], role: 'APPROVER', isActive: true },
      create: {
        id: SHOWCASE_ID.approvers[i],
        fullName: approverNames[i],
        email: approverEmails[i],
        passwordHash: showcaseApproverPasswordHash,
        role: 'APPROVER',
        isActive: true,
      },
    });
    approvers.push(user.id);
  }

  const vendorTemplates = [
    ['Northstar Cloudworks', 'Technology Services', 'hello@northstar-cloudworks.example', '+1-555-0101'],
    ['Blue Cedar Systems', 'Technology Services', 'contact@blue-cedar-systems.example', '+1-555-0102'],
    ['Summit Facilities Group', 'Facilities Services', 'bids@summit-facilities.example', '+1-555-0103'],
    ['Clearwater Advisory Partners', 'Professional Services', 'proposals@clearwater-advisory.example', '+1-555-0104'],
    ['Granite Ridge Construction', 'Construction Services', 'estimating@granite-ridge.example', '+1-555-0105'],
    ['Aster Learning Technologies', 'Technology Services', 'sales@aster-learning.example', '+1-555-0106'],
  ] as const;

  const vendors: string[] = [];
  for (let i = 0; i < vendorTemplates.length; i++) {
    const [name, typeName, email, phone] = vendorTemplates[i];
    const vendor = await prismaClient.vendor.upsert({
      where: { id: SHOWCASE_ID.vendors[i] },
      update: {
        name,
        vendorTypeId: vendorTypes.get(typeName)!,
        contactDetails: { email, phone },
      },
      create: {
        id: SHOWCASE_ID.vendors[i],
        name,
        vendorTypeId: vendorTypes.get(typeName)!,
        contactDetails: { email, phone },
      },
    });
    vendors.push(vendor.id);
  }

  let contractCount = 0;
  let bidderCount = 0;
  let quotationCount = 0;
  let evaluationCount = 0;
  let workflowCount = 0;
  let decisionCount = 0;
  let notificationCount = 0;
  let auditCount = 0;

  for (let contractIndex = 0; contractIndex < contractTemplates.length; contractIndex++) {
    const template = contractTemplates[contractIndex];
    const departmentId = departments.get(template.department)!;
    const categoryId = categories.get(template.category)!;
    const vendorTypeId = vendorTypes.get(template.vendorType)!;

    const contract = await prismaClient.contractForm.upsert({
      where: { id: template.id },
      update: {
        formSchemaVersionId: latestSchema.id,
        dynamicValues: buildShowcaseDynamicValues(schemaDefinition, contractIndex) as Prisma.InputJsonObject,
        referenceNo: template.referenceNo,
        title: template.title,
        sponsorDepartmentId: departmentId,
        contractCategoryId: categoryId,
        scope: `Deliver ${template.title.toLowerCase()} under a controlled procurement with measurable service levels and documented acceptance criteria.`,
        procurementRationale: `A competitive sourcing process is required to establish commercial value, technical fit and contractual safeguards for ${template.title.toLowerCase()}.`,
        budgetProvision: new Prisma.Decimal(template.budget),
        contractAmount: new Prisma.Decimal(template.amount),
        taxAmount: new Prisma.Decimal(template.tax),
        currencyId: currency.id,
        status: template.status,
        createdById: submitter.id,
        submittedAt: template.status === ContractStatus.DRAFT ? null : new Date(`2026-11-${String(15 + contractIndex).padStart(2, '0')}T09:00:00Z`),
      },
      create: {
        id: template.id,
        formSchemaVersionId: latestSchema.id,
        dynamicValues: buildShowcaseDynamicValues(schemaDefinition, contractIndex) as Prisma.InputJsonObject,
        referenceNo: template.referenceNo,
        title: template.title,
        sponsorDepartmentId: departmentId,
        contractCategoryId: categoryId,
        scope: `Deliver ${template.title.toLowerCase()} under a controlled procurement with measurable service levels and documented acceptance criteria.`,
        procurementRationale: `A competitive sourcing process is required to establish commercial value, technical fit and contractual safeguards for ${template.title.toLowerCase()}.`,
        budgetProvision: new Prisma.Decimal(template.budget),
        contractAmount: new Prisma.Decimal(template.amount),
        taxAmount: new Prisma.Decimal(template.tax),
        currencyId: currency.id,
        status: template.status,
        createdById: submitter.id,
        submittedAt: template.status === ContractStatus.DRAFT ? null : new Date(`2026-11-${String(15 + contractIndex).padStart(2, '0')}T09:00:00Z`),
      },
    });
    contractCount++;

    const bidderBase = contractIndex * 3;
    const bidderIds: string[] = [];
    for (let bidderIndex = 0; bidderIndex < 3; bidderIndex++) {
      const vendorIndex = (bidderBase + bidderIndex) % vendors.length;
      const bidderId = `30000000-0000-4000-8000-${String(bidderBase + bidderIndex + 1).padStart(12, '0')}`;
      const bidderName = await prismaClient.vendor.findUnique({ where: { id: vendors[vendorIndex] }, select: { name: true } });
      const bidder = await prismaClient.bidder.upsert({
        where: { id: bidderId },
        update: {
          contractFormId: contract.id,
          vendorId: vendors[vendorIndex],
          vendorTypeId: bidderIndex === 0 ? vendorTypeId : vendorTypes.get(vendorTemplates[vendorIndex][1])!,
          companyName: bidderName!.name,
          contactPerson: ['Alex Morgan', 'Priya Raman', 'Lee Walker'][bidderIndex],
          email: `bid${bidderIndex + 1}@${bidderName!.name.toLowerCase().replace(/[^a-z]+/g, '-')}.example`,
          phone: `+1-555-${String(1101 + bidderBase + bidderIndex)}`,
          qualifications: bidderIndex === 0
            ? 'ISO-certified delivery capability, relevant sector references and dedicated named account leadership.'
            : 'Demonstrated service capability, qualified staff and a documented delivery methodology.',
          sortOrder: bidderIndex + 1,
        },
        create: {
          id: bidderId,
          contractFormId: contract.id,
          vendorId: vendors[vendorIndex],
          vendorTypeId: bidderIndex === 0 ? vendorTypeId : vendorTypes.get(vendorTemplates[vendorIndex][1])!,
          companyName: bidderName!.name,
          contactPerson: ['Alex Morgan', 'Priya Raman', 'Lee Walker'][bidderIndex],
          email: `bid${bidderIndex + 1}@${bidderName!.name.toLowerCase().replace(/[^a-z]+/g, '-')}.example`,
          phone: `+1-555-${String(1101 + bidderBase + bidderIndex)}`,
          qualifications: bidderIndex === 0
            ? 'ISO-certified delivery capability, relevant sector references and dedicated named account leadership.'
            : 'Demonstrated service capability, qualified staff and a documented delivery methodology.',
          sortOrder: bidderIndex + 1,
        },
      });
      bidderIds.push(bidder.id);
      bidderCount++;

      const baseAmount = new Prisma.Decimal(template.amount);
      const quoted = baseAmount.mul(new Prisma.Decimal(['1.00', '1.08', '1.14'][bidderIndex]));
      const quotationId = `40000000-0000-4000-8000-${String(bidderBase + bidderIndex + 1).padStart(12, '0')}`;
      await prismaClient.quotation.upsert({
        where: { id: quotationId },
        update: {
          bidderId: bidder.id,
          quotedAmount: quoted,
          currencyId: currency.id,
          quotationDate: new Date(`2026-11-${String(5 + bidderIndex).padStart(2, '0')}T00:00:00Z`),
          notes: bidderIndex === 0 ? 'Best-and-final offer with implementation schedule included.' : 'Commercial offer with standard implementation assumptions.',
        },
        create: {
          id: quotationId,
          bidderId: bidder.id,
          quotedAmount: quoted,
          currencyId: currency.id,
          quotationDate: new Date(`2026-11-${String(5 + bidderIndex).padStart(2, '0')}T00:00:00Z`),
          notes: bidderIndex === 0 ? 'Best-and-final offer with implementation schedule included.' : 'Commercial offer with standard implementation assumptions.',
        },
      });
      quotationCount++;

      for (const type of [EvaluationType.TECHNICAL, EvaluationType.COMMERCIAL]) {
        const evaluationId = `50000000-0000-4000-8000-${String(bidderBase * 2 + bidderIndex * 2 + (type === EvaluationType.TECHNICAL ? 1 : 2)).padStart(12, '0')}`;
        const technical = type === EvaluationType.TECHNICAL;
        const score = technical ? ['92.0000', '84.0000', '78.0000'][bidderIndex] : ['88.0000', '82.0000', '76.0000'][bidderIndex];
        await prismaClient.evaluation.upsert({
          where: { id: evaluationId },
          update: {
            contractFormId: contract.id,
            bidderId: bidder.id,
            type,
            score: new Prisma.Decimal(score),
            remarks: technical
              ? `The proposal demonstrates ${bidderIndex === 0 ? 'strong' : 'acceptable'} technical capability, qualified resources and realistic delivery milestones.`
              : `The commercial response is ${bidderIndex === 0 ? 'competitive and within budget, with favorable payment terms' : 'plausible, but less competitive or with higher delivery risk'}.`,
            evaluatedById: approvers[contractIndex % approvers.length],
          },
          create: {
            id: evaluationId,
            contractFormId: contract.id,
            bidderId: bidder.id,
            type,
            score: new Prisma.Decimal(score),
            remarks: technical
              ? `The proposal demonstrates ${bidderIndex === 0 ? 'strong' : 'acceptable'} technical capability, qualified resources and realistic delivery milestones.`
              : `The commercial response is ${bidderIndex === 0 ? 'competitive and within budget, with favorable payment terms' : 'plausible, but less competitive or with higher delivery risk'}.`,
            evaluatedById: approvers[contractIndex % approvers.length],
          },
        });
        evaluationCount++;
      }
    }

    await prismaClient.contractForm.update({
      where: { id: contract.id },
      data: {
        recommendedVendorId: vendors[(bidderBase) % vendors.length],
        recommendedBidderId: bidderIds[0],
        selectionRationale: `The recommended bidder offers the strongest combined technical suitability and commercial value, supported by relevant qualifications, named delivery resources and a competitive quotation. The selection meets the applicable procurement requirements and risk controls.`,
      },
    });

    const costTemplates = contractIndex === 6
      ? [
          ['Resilience architecture and design review', '1', '185000.0000'],
          ['Infrastructure upgrades and implementation', '1', '142500.0000'],
          ['Failover testing and operational handover', '1', '50000.0000'],
        ] as const
      : contractIndex === 7
        ? [
            ['Records preparation and secure intake', '1', '80000.0000'],
            ['Scanning, indexing and quality assurance', '1', '55000.0000'],
            ['Encrypted archive setup and training', '1', '20000.0000'],
          ] as const
        : contractIndex === 8
          ? [
              ['Procurement review and process mapping', '1', '45000.0000'],
              ['Service configuration and handover', '1', '30000.0000'],
              ['Training materials and support', '1', '12000.0000'],
            ] as const
          : [
      ['Professional services and project delivery', '1', '185000.0000'],
      ['Implementation, configuration and transition', '1', '142500.0000'],
      ['Training and operational handover', '40', '1250.0000'],
            ] as const;
    for (let lineIndex = 0; lineIndex < costTemplates.length; lineIndex++) {
      const [description, quantity, unitCost] = costTemplates[lineIndex];
      const amount = showcaseCostAmount(quantity, unitCost);
      const lineId = `60000000-0000-4000-8000-${String(contractIndex * 3 + lineIndex + 1).padStart(12, '0')}`;
      await prismaClient.costLine.upsert({
        where: { id: lineId },
        update: {
          contractFormId: contract.id,
          description,
          quantity: new Prisma.Decimal(quantity),
          unitCost: new Prisma.Decimal(unitCost),
          amount,
          sortOrder: lineIndex + 1,
        },
        create: {
          id: lineId,
          contractFormId: contract.id,
          description,
          quantity: new Prisma.Decimal(quantity),
          unitCost: new Prisma.Decimal(unitCost),
          amount,
          sortOrder: lineIndex + 1,
        },
      });
    }

    await prismaClient.auditLog.upsert({
      where: { id: `70000000-0000-4000-8000-${String(contractIndex + 1).padStart(12, '0')}` },
      update: {},
      create: {
        id: `70000000-0000-4000-8000-${String(contractIndex + 1).padStart(12, '0')}`,
        actorId: submitter.id,
        action: 'CONTRACT_CREATED',
        entityType: 'ContractForm',
        entityId: contract.id,
        contractFormId: contract.id,
        details: { showcaseOwned: true, source: 'showcase-seed' },
      },
    });
    auditCount++;

    if (template.status === ContractStatus.DRAFT) continue;

    const levelCount = template.id === MULTI_LEVEL_REJECTION_ID || contractIndex === 1 || contractIndex === 3
      ? 2
      : 3;
    workflowCount++;

    for (let level = 1; level <= levelCount; level++) {
      const stepId = `80000000-0000-4000-8000-${String(contractIndex * 10 + level).padStart(12, '0')}`;
      const approverId = template.id === DEMO_APPROVER_PENDING_ID && level === 1
        ? demoApprover.id
        : approvers[(contractIndex + level - 1) % approvers.length];
      let stepStatus: ApprovalStatus = ApprovalStatus.WAITING;
      let actedAt: Date | null = null;

      if (template.status === ContractStatus.PENDING_APPROVAL) {
        stepStatus = level === 1 ? ApprovalStatus.PENDING : ApprovalStatus.WAITING;
      } else if (template.status === ContractStatus.APPROVED) {
        stepStatus = ApprovalStatus.APPROVED;
        actedAt = new Date(`2026-11-${String(16 + level).padStart(2, '0')}T12:00:00Z`);
      } else if (template.status === ContractStatus.RETURNED) {
        stepStatus = level === 1 ? ApprovalStatus.RETURNED : ApprovalStatus.WAITING;
        actedAt = level === 1 ? new Date('2026-11-20T12:00:00Z') : null;
      } else if (template.id === MULTI_LEVEL_REJECTION_ID) {
        stepStatus = level === 1 ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
        actedAt = new Date(level === 1 ? '2026-11-24T12:00:00Z' : '2026-11-25T12:00:00Z');
      } else if (template.status === ContractStatus.REJECTED) {
        stepStatus = level === 1 ? ApprovalStatus.REJECTED : ApprovalStatus.REJECTED;
        actedAt = level === 1 ? new Date('2026-11-21T12:00:00Z') : null;
      }

      await prismaClient.approvalStep.upsert({
        where: { id: stepId },
        update: { contractFormId: contract.id, level, approverId, status: stepStatus, actedAt },
        create: { id: stepId, contractFormId: contract.id, level, approverId, status: stepStatus, actedAt },
      });

      if (template.status === ContractStatus.APPROVED || (template.id === MULTI_LEVEL_REJECTION_ID && level === 1)) {
        const decisionId = `90000000-0000-4000-8000-${String(contractIndex * 10 + level).padStart(12, '0')}`;
        const comment = template.id === MULTI_LEVEL_REJECTION_ID
          ? 'The resilience design, failover approach and implementation milestones meet the technical requirements. Proceed to the final commercial review.'
          : `Level ${level} approved after technical and commercial review.`;
        await prismaClient.approvalDecision.upsert({
          where: { id: decisionId },
          update: {
            approvalStepId: stepId,
            contractFormId: contract.id,
            actorId: approverId,
            decision: ApprovalDecisionValue.APPROVED,
            comment,
            createdAt: actedAt!,
          },
          create: {
            id: decisionId,
            approvalStepId: stepId,
            contractFormId: contract.id,
            actorId: approverId,
            decision: ApprovalDecisionValue.APPROVED,
            comment,
            createdAt: actedAt!,
          },
        });
        decisionCount++;
      } else if (template.status === ContractStatus.RETURNED && level === 1) {
        const decisionId = `90000000-0000-4000-8000-${String(contractIndex * 10 + level).padStart(12, '0')}`;
        await prismaClient.approvalDecision.upsert({
          where: { id: decisionId },
          update: { approvalStepId: stepId, contractFormId: contract.id, actorId: approverId, decision: ApprovalDecisionValue.RETURNED, comment: 'Please add service-level assumptions and revise the cost breakdown before resubmission.', createdAt: actedAt! },
          create: { id: decisionId, approvalStepId: stepId, contractFormId: contract.id, actorId: approverId, decision: ApprovalDecisionValue.RETURNED, comment: 'Please add service-level assumptions and revise the cost breakdown before resubmission.', createdAt: actedAt! },
        });
        decisionCount++;
      } else if (template.status === ContractStatus.REJECTED && template.id !== MULTI_LEVEL_REJECTION_ID && level === 1) {
        const decisionId = `90000000-0000-4000-8000-${String(contractIndex * 10 + level).padStart(12, '0')}`;
        await prismaClient.approvalDecision.upsert({
          where: { id: decisionId },
          update: { approvalStepId: stepId, contractFormId: contract.id, actorId: approverId, decision: ApprovalDecisionValue.REJECTED, comment: 'Rejected because the proposed budget exceeds the approved funding envelope and the procurement rationale is not sufficiently supported.', createdAt: actedAt! },
          create: { id: decisionId, approvalStepId: stepId, contractFormId: contract.id, actorId: approverId, decision: ApprovalDecisionValue.REJECTED, comment: 'Rejected because the proposed budget exceeds the approved funding envelope and the procurement rationale is not sufficiently supported.', createdAt: actedAt! },
        });
        decisionCount++;
      } else if (template.id === MULTI_LEVEL_REJECTION_ID && level === 2) {
        const decisionId = `90000000-0000-4000-8000-${String(contractIndex * 10 + level).padStart(12, '0')}`;
        const comment = 'The proposed recurring support fees exceed the approved ceiling, and the bidder has not provided the required price-lock commitment. The procurement cannot proceed on these commercial terms.';
        await prismaClient.approvalDecision.upsert({
          where: { id: decisionId },
          update: {
            approvalStepId: stepId,
            contractFormId: contract.id,
            actorId: approverId,
            decision: ApprovalDecisionValue.REJECTED,
            comment,
            createdAt: actedAt!,
          },
          create: {
            id: decisionId,
            approvalStepId: stepId,
            contractFormId: contract.id,
            actorId: approverId,
            decision: ApprovalDecisionValue.REJECTED,
            comment,
            createdAt: actedAt!,
          },
        });
        decisionCount++;
      }

      if (template.status === ContractStatus.PENDING_APPROVAL && level === 1) {
        const notificationId = `a0000000-0000-4000-8000-${String(contractIndex * 10 + level).padStart(12, '0')}`;
        await prismaClient.notification.upsert({
          where: { id: notificationId },
          update: { recipientId: approverId, contractFormId: contract.id, message: `${template.referenceNo} has been submitted and is pending your approval (Level 1).`, isRead: false, channel: 'in-app' },
          create: { id: notificationId, recipientId: approverId, contractFormId: contract.id, message: `${template.referenceNo} has been submitted and is pending your approval (Level 1).`, isRead: false, channel: 'in-app' },
        });
        notificationCount++;
      }

      if (template.id === MULTI_LEVEL_REJECTION_ID && level === 1) {
        for (const [notificationId, recipientId, message] of [
          [
            'a4000000-0000-4000-8000-000000000001',
            approvers[(contractIndex + 1) % approvers.length],
            `${template.referenceNo} requires your approval (Level 2).`,
          ],
          [
            'a5000000-0000-4000-8000-000000000001',
            submitter.id,
            `${template.referenceNo} was approved at Level 1 and is pending approval at Level 2.`,
          ],
        ] as const) {
          await prismaClient.notification.upsert({
            where: { id: notificationId },
            update: { recipientId, contractFormId: contract.id, message, isRead: false, channel: 'in-app' },
            create: { id: notificationId, recipientId, contractFormId: contract.id, message, isRead: false, channel: 'in-app' },
          });
          notificationCount++;
        }
      }

      if (template.id === MULTI_LEVEL_REJECTION_ID && level === 2) {
        const comment = 'The proposed recurring support fees exceed the approved ceiling, and the bidder has not provided the required price-lock commitment.';
        const notificationId = 'a6000000-0000-4000-8000-000000000001';
        await prismaClient.notification.upsert({
          where: { id: notificationId },
          update: {
            recipientId: submitter.id,
            contractFormId: contract.id,
            message: `${template.referenceNo} was rejected at Level 2: ${comment}`,
            isRead: false,
            channel: 'in-app',
          },
          create: {
            id: notificationId,
            recipientId: submitter.id,
            contractFormId: contract.id,
            message: `${template.referenceNo} was rejected at Level 2: ${comment}`,
            isRead: false,
            channel: 'in-app',
          },
        });
        notificationCount++;
      }
    }

    const submittedAuditId = `b1000000-0000-4000-8000-${String(contractIndex + 1).padStart(12, '0')}`;
    await prismaClient.auditLog.upsert({
      where: { id: submittedAuditId },
      update: {},
      create: {
        id: submittedAuditId,
        actorId: submitter.id,
        action: 'CONTRACT_SUBMITTED',
        entityType: 'ContractForm',
        entityId: contract.id,
        contractFormId: contract.id,
        details: { showcaseOwned: true, levelsCount: levelCount },
      },
    });
    auditCount++;

    if (template.status === ContractStatus.APPROVED) {
      for (let level = 1; level <= levelCount; level++) {
        const auditId = `b2000000-0000-4000-8000-${String(contractIndex * 10 + level).padStart(12, '0')}`;
        await prismaClient.auditLog.upsert({
          where: { id: auditId },
          update: {},
          create: {
            id: auditId,
            actorId: approvers[(contractIndex + level - 1) % approvers.length],
            action: level === levelCount ? 'CONTRACT_FINAL_APPROVED' : 'APPROVAL_STEP_APPROVED',
            entityType: level === levelCount ? 'ContractForm' : 'ApprovalStep',
            entityId: level === levelCount ? contract.id : `80000000-0000-4000-8000-${String(contractIndex * 10 + level).padStart(12, '0')}`,
            contractFormId: contract.id,
            details: { showcaseOwned: true, level, decision: 'APPROVED' },
          },
        });
        auditCount++;
      }
      const notificationId = `a1000000-0000-4000-8000-${String(contractIndex + 1).padStart(12, '0')}`;
      await prismaClient.notification.upsert({
        where: { id: notificationId },
        update: { recipientId: submitter.id, contractFormId: contract.id, message: `${template.referenceNo} has received final approval and is now APPROVED.`, isRead: false, channel: 'in-app' },
        create: { id: notificationId, recipientId: submitter.id, contractFormId: contract.id, message: `${template.referenceNo} has received final approval and is now APPROVED.`, isRead: false, channel: 'in-app' },
      });
      notificationCount++;
    } else if (template.status === ContractStatus.RETURNED) {
      const stepId = `80000000-0000-4000-8000-${String(contractIndex * 10 + 1).padStart(12, '0')}`;
      await prismaClient.auditLog.upsert({
        where: { id: `b3000000-0000-4000-8000-${String(contractIndex + 1).padStart(12, '0')}` },
        update: {},
        create: { id: `b3000000-0000-4000-8000-${String(contractIndex + 1).padStart(12, '0')}`, actorId: approvers[contractIndex % approvers.length], action: 'CONTRACT_RETURNED', entityType: 'ContractForm', entityId: contract.id, contractFormId: contract.id, details: { showcaseOwned: true, stepId, decision: 'RETURNED', comment: 'Please add service-level assumptions and revise the cost breakdown before resubmission.' } },
      });
      auditCount++;
      await prismaClient.notification.upsert({
        where: { id: `a2000000-0000-4000-8000-${String(contractIndex + 1).padStart(12, '0')}` },
        update: { recipientId: submitter.id, contractFormId: contract.id, message: `${template.referenceNo} was returned for modifications: Please add service-level assumptions and revise the cost breakdown before resubmission.`, isRead: false, channel: 'in-app' },
        create: { id: `a2000000-0000-4000-8000-${String(contractIndex + 1).padStart(12, '0')}`, recipientId: submitter.id, contractFormId: contract.id, message: `${template.referenceNo} was returned for modifications: Please add service-level assumptions and revise the cost breakdown before resubmission.`, isRead: false, channel: 'in-app' },
      });
      notificationCount++;
    } else if (template.status === ContractStatus.REJECTED) {
      if (template.id === MULTI_LEVEL_REJECTION_ID) {
        const levelOneId = `80000000-0000-4000-8000-${String(contractIndex * 10 + 1).padStart(12, '0')}`;
        const levelTwoId = `80000000-0000-4000-8000-${String(contractIndex * 10 + 2).padStart(12, '0')}`;
        const levelOneApprover = approvers[(contractIndex + 1 - 1) % approvers.length];
        const levelTwoApprover = approvers[(contractIndex + 2 - 1) % approvers.length];
        const approveComment = 'The resilience design, failover approach and implementation milestones meet the technical requirements. Proceed to the final commercial review.';
        const rejectComment = 'The proposed recurring support fees exceed the approved ceiling, and the bidder has not provided the required price-lock commitment.';
        const auditEvents = [
          {
            id: 'b5000000-0000-4000-8000-000000000001',
            actorId: levelOneApprover,
            action: 'APPROVAL_STEP_APPROVED',
            entityType: 'ApprovalStep',
            entityId: levelOneId,
            details: { showcaseOwned: true, stepId: levelOneId, level: 1, decision: 'APPROVED', comment: approveComment, nextLevelActivated: 2, nextApproverId: levelTwoApprover },
          },
          {
            id: 'b6000000-0000-4000-8000-000000000001',
            actorId: levelTwoApprover,
            action: 'CONTRACT_REJECTED',
            entityType: 'ContractForm',
            entityId: contract.id,
            details: { showcaseOwned: true, stepId: levelTwoId, level: 2, decision: 'REJECTED', comment: rejectComment },
          },
        ] as const;
        for (const event of auditEvents) {
          await prismaClient.auditLog.upsert({
            where: { id: event.id },
            update: {},
            create: {
              id: event.id,
              actorId: event.actorId,
              action: event.action,
              entityType: event.entityType,
              entityId: event.entityId,
              contractFormId: contract.id,
              details: event.details,
            },
          });
          auditCount++;
        }
      } else {
        await prismaClient.auditLog.upsert({
          where: { id: `b4000000-0000-4000-8000-${String(contractIndex + 1).padStart(12, '0')}` },
          update: {},
          create: { id: `b4000000-0000-4000-8000-${String(contractIndex + 1).padStart(12, '0')}`, actorId: approvers[contractIndex % approvers.length], action: 'CONTRACT_REJECTED', entityType: 'ContractForm', entityId: contract.id, contractFormId: contract.id, details: { showcaseOwned: true, decision: 'REJECTED', comment: 'Rejected because the proposed budget exceeds the approved funding envelope and the procurement rationale is not sufficiently supported.' } },
        });
        auditCount++;
      }
      if (template.id !== MULTI_LEVEL_REJECTION_ID) {
        await prismaClient.notification.upsert({
          where: { id: `a3000000-0000-4000-8000-${String(contractIndex + 1).padStart(12, '0')}` },
          update: { recipientId: submitter.id, contractFormId: contract.id, message: `${template.referenceNo} was rejected: The proposed budget exceeds the approved funding envelope and the procurement rationale is not sufficiently supported.`, isRead: false, channel: 'in-app' },
          create: { id: `a3000000-0000-4000-8000-${String(contractIndex + 1).padStart(12, '0')}`, recipientId: submitter.id, contractFormId: contract.id, message: `${template.referenceNo} was rejected: The proposed budget exceeds the approved funding envelope and the procurement rationale is not sufficiently supported.`, isRead: false, channel: 'in-app' },
        });
        notificationCount++;
      }
    }
  }

  const rejectionContract = await prismaClient.contractForm.findUnique({
    where: { id: MULTI_LEVEL_REJECTION_ID },
    include: {
      approvalSteps: { orderBy: { level: 'asc' } },
      approvalDecisions: true,
    },
  });
  if (!rejectionContract) throw new Error('Showcase multi-level rejection contract was not persisted.');
  assertShowcaseTwoLevelRejection({
    status: rejectionContract.status,
    approvalSteps: rejectionContract.approvalSteps,
    decisions: rejectionContract.approvalDecisions,
  });

  const pendingDemoContract = await prismaClient.contractForm.findUnique({
    where: { id: DEMO_APPROVER_PENDING_ID },
    include: {
      createdBy: { select: { email: true } },
      approvalSteps: {
        orderBy: { level: 'asc' },
        include: { approver: { select: { email: true } } },
      },
    },
  });
  if (!pendingDemoContract) throw new Error('Showcase demo-approver contract was not persisted.');
  assertShowcaseSubmitterApproval({
    status: pendingDemoContract.status,
    createdByEmail: pendingDemoContract.createdBy.email,
    approvalSteps: pendingDemoContract.approvalSteps.map((step) => ({
      level: step.level,
      status: step.status,
      approverEmail: step.approver.email,
    })),
  });

  const demoUsersAfter = await prismaClient.user.findMany({
    where: { email: { in: [...DEMO_EMAILS] } },
    select: {
      id: true,
      fullName: true,
      email: true,
      passwordHash: true,
      role: true,
      isActive: true,
      departmentId: true,
      createdAt: true,
    },
  });
  for (const user of demoUsersAfter) {
    const before = demoUsersBefore.get(user.email);
    if (!before || JSON.stringify(before) !== JSON.stringify(user)) {
      throw new Error(`Protected demo account was changed by showcase seeding: ${user.email}`);
    }
  }

  const genuineAttachments = await uploadPdfShowcaseAttachment(prismaClient, submitter.id);

  return {
    showcaseContracts: contractCount,
    vendors: vendors.length,
    bidders: bidderCount,
    quotations: quotationCount,
    evaluations: evaluationCount,
    approvalWorkflows: workflowCount,
    approvalDecisions: decisionCount,
    notifications: notificationCount,
    auditRecords: auditCount,
    genuineAttachments,
  };
}

async function main(): Promise<void> {
  assertSafeExecution();
  const counts = await seedShowcase(prisma);
  console.log('Showcase seed complete.');
  console.log(JSON.stringify(counts, null, 2));
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, '/').endsWith('/prisma/seed-showcase.ts');
if (invokedDirectly) {
  main()
    .catch((error: unknown) => {
      console.error('Showcase seed failed:', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedShowcase };
