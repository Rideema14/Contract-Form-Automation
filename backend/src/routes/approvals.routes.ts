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
import { initializeWorkflowHandler } from '../controllers/approvalWorkflow.controller';

const router = Router();

router.use(authenticate);

// Initialize an approval workflow for a contract (called by Member 1 after contract creation)
// Expects { contractFormId, approverIds } in the body.
// Returns the created approval steps.
router.post('/workflow', initializeWorkflowHandler);


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
