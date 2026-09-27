import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { SettingsRepository } from '../repositories/settings.repository';
import { SettingsService } from '../services/settings.service';
import { authenticate, requireAdmin } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const settingsRepo = new SettingsRepository();
const settingsService = new SettingsService(settingsRepo);
const settingsController = new SettingsController(settingsService);

// ===== Settings Routes =====

// Public settings (no authentication needed)
router.get('/public', settingsController.getPublic);

// Protected routes (require authentication)
router.get('/', authenticate, settingsController.getAll);
router.get('/grouped', authenticate, settingsController.getGrouped);
router.get('/category/:category', authenticate, settingsController.getByCategory);
router.get('/category/:category/group/:group', authenticate, settingsController.getByCategoryAndGroup);
router.get('/key/:key', authenticate, settingsController.getByKey);
router.get('/value/:key', authenticate, settingsController.getValue);
router.get('/:id', authenticate, settingsController.getOne);

// Protected routes (require admin permissions)
router.post('/', authenticate, requireAdmin, requirePermission('settings:create'), settingsController.create);
router.put('/:id', authenticate, requireAdmin, requirePermission('settings:update'), settingsController.update);
router.delete('/:id', authenticate, requireAdmin, requirePermission('settings:delete'), settingsController.delete);

export { router as settingsRouter };