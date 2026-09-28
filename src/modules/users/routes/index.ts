import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { UserRepository } from '../repositories/user.repository';
import { UserService } from '../services/user.service';
import { authenticate, requireAdmin } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const userRepo = new UserRepository();
const userService = new UserService(userRepo);
const userController = new UserController(userService);

// ===== User Routes =====

// Profile (self) - إجراء شخصي متاح لأي حساب حتى "مشاهدة فقط"
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.put('/profile/password', authenticate, userController.changeMyPassword);

// ✅ لوحة إدارة الحسابات والصلاحيات مخصصة للسوبر أدمن فقط
// (إنشاء/تعديل/حذف الحسابات، الاطّلاع على القائمة، تحديد الصفحات المسموح بها)
router.get('/meta/pages', authenticate, requireAdmin, userController.getPagesRegistry);
router.get('/', authenticate, requireAdmin, userController.getAll);
router.get('/status/:status', authenticate, requireAdmin, userController.getByStatus);
router.get('/role/:role', authenticate, requireAdmin, userController.getByRole);
router.get('/:id', authenticate, requireAdmin, userController.getOne);

// Protected routes (require admin permissions)
router.post('/', authenticate, requireAdmin, requirePermission('users:create'), userController.create);
router.put('/:id', authenticate, requireAdmin, requirePermission('users:update'), userController.update);
router.delete('/:id', authenticate, requireAdmin, requirePermission('users:delete'), userController.delete);
router.patch('/:id/status', authenticate, requireAdmin, requirePermission('users:update'), userController.updateStatus);
router.patch('/:id/roles', authenticate, requireAdmin, requirePermission('users:update'), userController.updateRoles);
router.patch('/:id/pages', authenticate, requireAdmin, requirePermission('users:update'), userController.updatePages);
router.post('/:id/change-password', authenticate, requireAdmin, requirePermission('users:update'), userController.changePassword);
router.patch('/:id/reset-password', authenticate, requireAdmin, requirePermission('users:update'), userController.adminResetPassword);

export { router as usersRouter };