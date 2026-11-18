import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import { requireRoles } from '../middleware/authorize';
import { UserRole } from '@prisma/client';
import {
  approveStepHandler,
  getApprovalDetail,
  getApprovalHistoryHandler,
  listPendingApprovals,
  rejectStepHandler,
  returnStepHandler,
} from '../controllers/approvals.controller';

const router = Router();

router.use(authenticate);

// Pending queue accessible to APPROVER and ADMIN
router.get('/pending', requireRoles(UserRole.APPROVER, UserRole.ADMIN), listPendingApprovals);

// Contract approval history (placed before /:id to avoid route shadowing)
router.get('/history/:id', getApprovalHistoryHandler);
router.get('/forms/:id/history', getApprovalHistoryHandler);

// Step details
router.get('/:id', getApprovalDetail);

// Workflow decision actions (assigned approver strictly enforced in service)
router.post('/:id/approve', approveStepHandler);
router.post('/:id/return', returnStepHandler);
router.post('/:id/reject', rejectStepHandler);

export default router;
