import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import { listReferenceData } from '../controllers/reference-data.controller';

const router = Router();
router.use(authenticate);
router.get('/', listReferenceData);

export default router;
