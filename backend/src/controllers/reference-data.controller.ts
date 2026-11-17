import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { sendSuccess } from '../utils/response';

export async function listReferenceData(req: Request, res: Response, next: NextFunction) {
  try {
    const [departments, categories, currencies, vendors] = await Promise.all([
      prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.contractCategory.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
      prisma.vendor.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, vendorType: { select: { id: true, name: true } }, contactDetails: true },
      }),
    ]);

    sendSuccess(req, res, 200, 'Reference data retrieved', { departments, categories, currencies, vendors });
  } catch (error) {
    next(error);
  }
}
