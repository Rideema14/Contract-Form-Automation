import { Router } from 'express';
import approversRouter from './approvers.routes';

const router = Router();

// Register the approvers router under /users/approvers
router.use('/users/approvers', approversRouter);

export default router;
