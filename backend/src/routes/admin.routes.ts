import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import authenticate from '../middleware/authenticate';
import { requireRoles } from '../middleware/authorize';
import { listAuditHistory } from '../services/audit.service';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/response';

const router = Router();
const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(255).optional(),
}).strict();

router.use(authenticate);
router.get('/audit', requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid audit history query', parsed.error.issues);
    }

    const result = await listAuditHistory(parsed.data);
    sendSuccess(req, res, 200, 'Audit history retrieved', { items: result.items }, {
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
