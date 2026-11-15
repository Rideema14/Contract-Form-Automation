
import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';

const router = Router();

router.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Contract Forms API',
  });
});

router.use('/auth', authRoutes);

export default router;
