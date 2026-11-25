import { Router } from 'express';
import { ContractStatus, Prisma, UserRole } from '@prisma/client';
import authenticate from '../middleware/authenticate';
import { prisma } from '../lib/prisma';
import { sendSuccess } from '../utils/response';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    if (!req.authUser) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const visibility: Prisma.ContractFormWhereInput =
      req.authUser.role === UserRole.ADMIN
        ? {}
        : req.authUser.role === UserRole.APPROVER
          ? { approvalSteps: { some: { approverId: req.authUser.id } } }
          : { createdById: req.authUser.id };

    const [all, draft, pending, approved, returned, rejected, recent] = await Promise.all([
      prisma.contractForm.count({ where: visibility }),
      prisma.contractForm.count({ where: { ...visibility, status: ContractStatus.DRAFT } }),
      prisma.contractForm.count({ where: { ...visibility, status: ContractStatus.PENDING_APPROVAL } }),
      prisma.contractForm.count({ where: { ...visibility, status: ContractStatus.APPROVED } }),
      prisma.contractForm.count({ where: { ...visibility, status: ContractStatus.RETURNED } }),
      prisma.contractForm.count({
        where: { ...visibility, status: ContractStatus.REJECTED },
      }),
      prisma.contractForm.findMany({
        where: visibility,
        orderBy: { updatedAt: 'desc' },
        take: 8,
        include: {
          sponsorDepartment: true,
          contractCategory: true,
          currency: true,
          recommendedVendor: true,
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    sendSuccess(req, res, 200, 'Dashboard data retrieved', {
      counts: { all, draft, pending, approved, returned, rejected },
      recent,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
