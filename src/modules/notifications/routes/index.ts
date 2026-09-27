import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import {
  NotificationRepository,
  NotificationPreferenceRepository,
  PushDeviceRepository
} from '../repositories/notification.repository';
import { NotificationService } from '../services/notification.service';
import { authenticate, requireAdmin } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const notificationRepo = new NotificationRepository();
const preferenceRepo = new NotificationPreferenceRepository();
const deviceRepo = new PushDeviceRepository();
const notificationService = new NotificationService(
  notificationRepo,
  preferenceRepo,
  deviceRepo
);
const notificationController = new NotificationController(notificationService);

// ===== Notification Routes =====
router.post('/', authenticate, requireAdmin, notificationController.create);
router.get('/', authenticate, notificationController.getAll);
router.get('/unread', authenticate, notificationController.getUnread);
router.get('/unread/count', authenticate, notificationController.getUnreadCount);
// ✅ إجراءات شخصية على إشعارات المستخدم نفسه (متاحة لأي حساب، حتى "مشاهدة فقط")
router.put('/:id/read', authenticate, notificationController.markAsRead);
router.put('/read-all', authenticate, notificationController.markAllAsRead);
router.delete('/:id', authenticate, notificationController.delete);

// ===== Preferences Routes =====
router.get('/preferences', authenticate, notificationController.getPreferences);
router.put('/preferences', authenticate, notificationController.updatePreferences);

// ===== Push Device Routes (تسجيل جهاز المستخدم نفسه - إجراء شخصي) =====
router.post('/devices', authenticate, notificationController.registerDevice);
router.delete('/devices', authenticate, notificationController.unregisterDevice);
router.post('/push', authenticate, requireAdmin, notificationController.sendPush);

export { router as notificationRouter };