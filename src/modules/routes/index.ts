import { Router } from 'express';
import { authenticate } from '../../core/middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, (req, res) => {
  res.json({ success: true, message: 'Users API - تحت التطوير', data: [] });
});

router.post('/', authenticate, (req, res) => {
  res.status(201).json({ success: true, message: 'User created', data: { id: 'temp' } });
});

export { router as usersRouter };