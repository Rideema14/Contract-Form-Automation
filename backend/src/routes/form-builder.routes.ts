import { Router } from 'express';
import { UserRole } from '@prisma/client';
import authenticate from '../middleware/authenticate';
import { requireRoles } from '../middleware/authorize';
import {
  getFormSchemaDraft,
  getPublishedFormSchema,
  publishFormSchema,
  saveFormSchemaDraft,
} from '../controllers/form-builder.controller';

const router = Router();

router.use(authenticate);
router.get('/published', getPublishedFormSchema);
router.get('/draft', requireRoles(UserRole.ADMIN), getFormSchemaDraft);
router.put('/draft', requireRoles(UserRole.ADMIN), saveFormSchemaDraft);
router.post('/publish', requireRoles(UserRole.ADMIN), publishFormSchema);

export default router;
