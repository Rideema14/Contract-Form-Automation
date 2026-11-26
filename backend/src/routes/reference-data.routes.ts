import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import { requireRoles } from '../middleware/authorize';
import { UserRole } from '@prisma/client';
import {
  createReferenceRecord,
  deleteReferenceRecord,
  listReferenceData,
  updateReferenceRecord,
} from '../controllers/reference-data.controller';

const router = Router();
router.use(authenticate);
router.get('/', listReferenceData);
router.post('/:category', requireRoles(UserRole.ADMIN), createReferenceRecord);
router.patch('/:category/:id', requireRoles(UserRole.ADMIN), updateReferenceRecord);
router.delete('/:category/:id', requireRoles(UserRole.ADMIN), deleteReferenceRecord);

export default router;
