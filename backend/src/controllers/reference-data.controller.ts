import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';
import { recordAuditEvent } from '../services/audit.service';

type Category = 'departments' | 'categories' | 'vendor-types' | 'currencies' | 'vendors';

function categoryParam(req: Request): Category {
  const raw = Array.isArray(req.params.category) ? req.params.category[0] : req.params.category;
  if (!['departments', 'categories', 'vendor-types', 'currencies', 'vendors'].includes(raw)) {
    throw new AppError(404, 'NOT_FOUND', 'Reference data category not found');
  }
  return raw as Category;
}

function idParam(req: Request): string {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
}

function getActorId(req: Request): string {
  if (!req.authUser) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
  }
  return req.authUser.id;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field} is required`);
  }
  return value.trim();
}

function validateVendorContactDetails(value: unknown): void {
  if (value === null || value === undefined) return;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Contact details must be an object');
  }

  const details = value as Record<string, unknown>;
  for (const [field, maxLength] of [
    ['contactPerson', 255],
    ['email', 254],
    ['phone', 25],
    ['qualifications', 10000],
  ] as const) {
    const fieldValue = details[field];
    if (fieldValue !== undefined && fieldValue !== null && typeof fieldValue !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', `${field} must be text`);
    }
    if (typeof fieldValue === 'string' && fieldValue.length > maxLength) {
      throw new AppError(400, 'VALIDATION_ERROR', `${field} must be ${maxLength} characters or fewer`);
    }
  }

  const email = typeof details.email === 'string' ? details.email.trim() : '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid email address');
  }

  const phone = typeof details.phone === 'string' ? details.phone.trim() : '';
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (!/^\+?[0-9\s().-]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Enter a phone number with 7 to 15 digits');
    }
  }
}

async function rejectNameDuplicate(model: 'department' | 'contractCategory' | 'vendorType' | 'vendor', name: string, id?: string): Promise<void> {
  let records: { id: string; name: string }[];
  if (model === 'department') {
    records = await prisma.department.findMany({ select: { id: true, name: true } });
  } else if (model === 'contractCategory') {
    records = await prisma.contractCategory.findMany({ select: { id: true, name: true } });
  } else if (model === 'vendorType') {
    records = await prisma.vendorType.findMany({ select: { id: true, name: true } });
  } else {
    records = await prisma.vendor.findMany({ select: { id: true, name: true } });
  }
  if (records.some((record) => record.id !== id && record.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new AppError(409, 'DUPLICATE_REFERENCE_DATA', `A record named "${name}" already exists`);
  }
}

export async function listReferenceData(req: Request, res: Response, next: NextFunction) {
  try {
    const [departments, categories, vendorTypes, currencies, vendors] = await Promise.all([
      prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.contractCategory.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.vendorType.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
      prisma.vendor.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, vendorType: { select: { id: true, name: true } }, contactDetails: true },
      }),
    ]);

    sendSuccess(req, res, 200, 'Reference data retrieved', { departments, categories, vendorTypes, currencies, vendors });
  } catch (error) {
    next(error);
  }
}

export async function createReferenceRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const category = categoryParam(req);
    const actorId = getActorId(req);
    let record: unknown;

    if (category === 'departments') {
      const name = requiredText(req.body?.name, 'Name');
      await rejectNameDuplicate('department', name);
      record = await prisma.$transaction(async (tx) => {
        const created = await tx.department.create({ data: { name }, select: { id: true, name: true } });
        await recordAuditEvent(tx, {
          actorId, action: 'REFERENCE_DATA_CREATED', entityType: 'ReferenceData', entityId: created.id,
          details: { category, name: created.name },
        });
        return created;
      });
    } else if (category === 'categories') {
      const name = requiredText(req.body?.name, 'Name');
      await rejectNameDuplicate('contractCategory', name);
      record = await prisma.$transaction(async (tx) => {
        const created = await tx.contractCategory.create({ data: { name }, select: { id: true, name: true } });
        await recordAuditEvent(tx, {
          actorId, action: 'REFERENCE_DATA_CREATED', entityType: 'ReferenceData', entityId: created.id,
          details: { category, name: created.name },
        });
        return created;
      });
    } else if (category === 'vendor-types') {
      const name = requiredText(req.body?.name, 'Name');
      await rejectNameDuplicate('vendorType', name);
      record = await prisma.$transaction(async (tx) => {
        const created = await tx.vendorType.create({ data: { name }, select: { id: true, name: true } });
        await recordAuditEvent(tx, {
          actorId, action: 'REFERENCE_DATA_CREATED', entityType: 'ReferenceData', entityId: created.id,
          details: { category, name: created.name },
        });
        return created;
      });
    } else if (category === 'currencies') {
      const code = requiredText(req.body?.code, 'Currency code').toUpperCase();
      const name = requiredText(req.body?.name, 'Currency name');
      if (code.length > 10) throw new AppError(400, 'VALIDATION_ERROR', 'Currency code must be 10 characters or fewer');
      const existingCode = await prisma.currency.findUnique({ where: { code } });
      if (existingCode) throw new AppError(409, 'DUPLICATE_REFERENCE_DATA', `Currency code "${code}" already exists`);
      const currencies = await prisma.currency.findMany({ select: { id: true, name: true } });
      if (currencies.some((item) => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
        throw new AppError(409, 'DUPLICATE_REFERENCE_DATA', `Currency name "${name}" already exists`);
      }
      record = await prisma.$transaction(async (tx) => {
        const created = await tx.currency.create({ data: { code, name }, select: { id: true, code: true, name: true } });
        await recordAuditEvent(tx, {
          actorId, action: 'REFERENCE_DATA_CREATED', entityType: 'ReferenceData', entityId: created.id,
          details: { category, code: created.code, name: created.name },
        });
        return created;
      });
    } else {
      const name = requiredText(req.body?.name, 'Vendor name');
      await rejectNameDuplicate('vendor', name);
      const vendorTypeId = requiredText(req.body?.vendorTypeId, 'Vendor type');
      if (!await prisma.vendorType.findUnique({ where: { id: vendorTypeId } })) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid vendor type');
      }
      validateVendorContactDetails(req.body?.contactDetails);
      const contactDetails = req.body?.contactDetails && typeof req.body.contactDetails === 'object'
        ? req.body.contactDetails
        : null;
      record = await prisma.$transaction(async (tx) => {
        const created = await tx.vendor.create({
          data: { name, vendorTypeId, contactDetails },
          select: { id: true, name: true, vendorType: { select: { id: true, name: true } }, contactDetails: true },
        });
        await recordAuditEvent(tx, {
          actorId, action: 'REFERENCE_DATA_CREATED', entityType: 'ReferenceData', entityId: created.id,
          details: { category, name: created.name, vendorTypeId },
        });
        return created;
      });
    }

    sendSuccess(req, res, 201, 'Reference data created', record);
  } catch (error) {
    next(error);
  }
}

export async function updateReferenceRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const category = categoryParam(req);
    const id = idParam(req);
    const actorId = getActorId(req);
    let record: unknown;

    if (category === 'departments') {
      const name = requiredText(req.body?.name, 'Name');
      await rejectNameDuplicate('department', name, id);
      record = await prisma.$transaction(async (tx) => {
        const updated = await tx.department.update({ where: { id }, data: { name }, select: { id: true, name: true } });
        await recordAuditEvent(tx, {
          actorId, action: 'REFERENCE_DATA_UPDATED', entityType: 'ReferenceData', entityId: id,
          details: { category, changedFields: Object.keys(req.body ?? {}).sort() },
        });
        return updated;
      });
    } else if (category === 'categories') {
      const name = requiredText(req.body?.name, 'Name');
      await rejectNameDuplicate('contractCategory', name, id);
      record = await prisma.$transaction(async (tx) => {
        const updated = await tx.contractCategory.update({ where: { id }, data: { name }, select: { id: true, name: true } });
        await recordAuditEvent(tx, {
          actorId, action: 'REFERENCE_DATA_UPDATED', entityType: 'ReferenceData', entityId: id,
          details: { category, changedFields: Object.keys(req.body ?? {}).sort() },
        });
        return updated;
      });
    } else if (category === 'vendor-types') {
      const name = requiredText(req.body?.name, 'Name');
      await rejectNameDuplicate('vendorType', name, id);
      record = await prisma.$transaction(async (tx) => {
        const updated = await tx.vendorType.update({ where: { id }, data: { name }, select: { id: true, name: true } });
        await recordAuditEvent(tx, {
          actorId, action: 'REFERENCE_DATA_UPDATED', entityType: 'ReferenceData', entityId: id,
          details: { category, changedFields: Object.keys(req.body ?? {}).sort() },
        });
        return updated;
      });
    } else if (category === 'currencies') {
      const code = requiredText(req.body?.code, 'Currency code').toUpperCase();
      const name = requiredText(req.body?.name, 'Currency name');
      if (code.length > 10) throw new AppError(400, 'VALIDATION_ERROR', 'Currency code must be 10 characters or fewer');
      const codeMatch = await prisma.currency.findUnique({ where: { code } });
      if (codeMatch && codeMatch.id !== id) throw new AppError(409, 'DUPLICATE_REFERENCE_DATA', `Currency code "${code}" already exists`);
      const currencies = await prisma.currency.findMany({ select: { id: true, name: true } });
      if (currencies.some((item) => item.id !== id && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
        throw new AppError(409, 'DUPLICATE_REFERENCE_DATA', `Currency name "${name}" already exists`);
      }
      record = await prisma.$transaction(async (tx) => {
        const updated = await tx.currency.update({ where: { id }, data: { code, name }, select: { id: true, code: true, name: true } });
        await recordAuditEvent(tx, {
          actorId, action: 'REFERENCE_DATA_UPDATED', entityType: 'ReferenceData', entityId: id,
          details: { category, changedFields: Object.keys(req.body ?? {}).sort() },
        });
        return updated;
      });
    } else {
      const name = requiredText(req.body?.name, 'Vendor name');
      await rejectNameDuplicate('vendor', name, id);
      const vendorTypeId = requiredText(req.body?.vendorTypeId, 'Vendor type');
      if (!await prisma.vendorType.findUnique({ where: { id: vendorTypeId } })) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid vendor type');
      }
      validateVendorContactDetails(req.body?.contactDetails);
      const contactDetails = req.body?.contactDetails && typeof req.body.contactDetails === 'object'
        ? req.body.contactDetails
        : null;
      record = await prisma.$transaction(async (tx) => {
        const updated = await tx.vendor.update({
          where: { id },
          data: { name, vendorTypeId, contactDetails },
          select: { id: true, name: true, vendorType: { select: { id: true, name: true } }, contactDetails: true },
        });
        await recordAuditEvent(tx, {
          actorId, action: 'REFERENCE_DATA_UPDATED', entityType: 'ReferenceData', entityId: id,
          details: { category, changedFields: Object.keys(req.body ?? {}).sort() },
        });
        return updated;
      });
    }

    sendSuccess(req, res, 200, 'Reference data updated', record);
  } catch (error) {
    next(error);
  }
}

export async function deleteReferenceRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const category = categoryParam(req);
    const id = idParam(req);
    const actorId = getActorId(req);
    let usageCount = 0;
    let reason = '';

    if (category === 'departments') {
      const [users, contracts] = await Promise.all([
        prisma.user.count({ where: { departmentId: id } }),
        prisma.contractForm.count({ where: { sponsorDepartmentId: id } }),
      ]);
      usageCount = users + contracts;
      reason = 'users or contract forms';
      if (usageCount === 0) {
        await prisma.$transaction(async (tx) => {
          await tx.department.delete({ where: { id } });
          await recordAuditEvent(tx, {
            actorId, action: 'REFERENCE_DATA_DELETED', entityType: 'ReferenceData', entityId: id,
            details: { category },
          });
        });
      }
    } else if (category === 'categories') {
      usageCount = await prisma.contractForm.count({ where: { contractCategoryId: id } });
      reason = 'contract forms';
      if (usageCount === 0) {
        await prisma.$transaction(async (tx) => {
          await tx.contractCategory.delete({ where: { id } });
          await recordAuditEvent(tx, {
            actorId, action: 'REFERENCE_DATA_DELETED', entityType: 'ReferenceData', entityId: id,
            details: { category },
          });
        });
      }
    } else if (category === 'vendor-types') {
      usageCount = await prisma.vendor.count({ where: { vendorTypeId: id } });
      reason = 'vendors';
      if (usageCount === 0) {
        await prisma.$transaction(async (tx) => {
          await tx.vendorType.delete({ where: { id } });
          await recordAuditEvent(tx, {
            actorId, action: 'REFERENCE_DATA_DELETED', entityType: 'ReferenceData', entityId: id,
            details: { category },
          });
        });
      }
    } else if (category === 'currencies') {
      const [contracts, quotations] = await Promise.all([
        prisma.contractForm.count({ where: { currencyId: id } }),
        prisma.quotation.count({ where: { currencyId: id } }),
      ]);
      usageCount = contracts + quotations;
      reason = 'contract forms or quotations';
      if (usageCount === 0) {
        await prisma.$transaction(async (tx) => {
          await tx.currency.delete({ where: { id } });
          await recordAuditEvent(tx, {
            actorId, action: 'REFERENCE_DATA_DELETED', entityType: 'ReferenceData', entityId: id,
            details: { category },
          });
        });
      }
    } else {
      const [contracts, bidders] = await Promise.all([
        prisma.contractForm.count({ where: { recommendedVendorId: id } }),
        prisma.bidder.count({ where: { vendorId: id } }),
      ]);
      usageCount = contracts + bidders;
      reason = 'contract forms or bidders';
      if (usageCount === 0) {
        await prisma.$transaction(async (tx) => {
          await tx.vendor.delete({ where: { id } });
          await recordAuditEvent(tx, {
            actorId, action: 'REFERENCE_DATA_DELETED', entityType: 'ReferenceData', entityId: id,
            details: { category },
          });
        });
      }
    }

    if (usageCount > 0) {
      throw new AppError(409, 'REFERENCE_DATA_IN_USE', `This record cannot be deleted because it is used by ${usageCount} ${reason}`);
    }
    sendSuccess(req, res, 200, 'Reference data deleted', { id });
  } catch (error) {
    next(error);
  }
}
