import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { UserRepository } from '../repositories/user.repository';
import { AuthService } from '../services/auth.service';
import { authenticate } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const userRepo = new UserRepository();
const authService = new AuthService(userRepo);
const authController = new AuthController(authService);

// Routes
router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/profile', authenticate, authController.profile);

export { router as authRouter };