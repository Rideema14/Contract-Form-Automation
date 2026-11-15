
import { Router } from 'express';
import {
  login,
  logout,
  getCurrentUser,
} from './auth.controller';
import authenticate from '../../middleware/authenticate';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticate, getCurrentUser);

export default router;
