import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import { listActiveApprovers } from '../controllers/approvers.controller';

const router = Router();

router.use(authenticate);

// GET /users/approvers
router.get('/approvers', listActiveApprovers);

export default router;
