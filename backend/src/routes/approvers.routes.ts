import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import { listActiveApprovers } from '../controllers/approvers.controller';

const router = Router();

router.use(authenticate);

// GET / returns the list of active approvers
router.get('/', listActiveApprovers);

export default router;
