import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateNotificationDTO, SendPushDTO } from '../models/notification.model';

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  // ===== Create Notification =====
  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateNotificationDTO = req.body;
    const notification = await this.notificationService.createNotification(data);
    res.status(201).json({
      success: true,
      message: 'Notification created',
      data: notification
    });
  });

  // ===== Get Notifications =====
  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id || 'system';
    const notifications = await this.notificationService.getNotifications(userId);
    res.json({
      success: true,
      data: notifications,
      count: notifications.length
    });
  });

  getUnread = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id || 'system';
    const notifications = await this.notificationService.getUnreadNotifications(userId);
    res.json({
      success: true,
      data: notifications,
      count: notifications.length
    });
  });

  getUnreadCount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id || 'system';
    const count = await this.notificationService.getUnreadCount(userId);
    res.json({
      success: true,
      data: { unreadCount: count }
    });
  });

  // ===== Mark as Read =====
  markAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const notification = await this.notificationService.markAsRead(id);
    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  });

  markAllAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id || 'system';
    await this.notificationService.markAllAsRead(userId);
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  });

  // ===== Delete =====
  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.notificationService.deleteNotification(id);
    res.json({
      success: true,
      message: 'Notification deleted'
    });
  });

  // ===== Preferences =====
  getPreferences = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id || 'system';
    const prefs = await this.notificationService.getPreferences(userId);
    res.json({
      success: true,
      data: prefs
    });
  });

  updatePreferences = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id || 'system';
    const data = req.body;
    const prefs = await this.notificationService.updatePreferences(userId, data);
    res.json({
      success: true,
      message: 'Preferences updated',
      data: prefs
    });
  });

  // ===== Push Devices =====
  registerDevice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id || 'system';
    const { deviceToken, deviceType, deviceName } = req.body;
    
    if (!deviceToken || !deviceType) {
      res.status(400).json({
        success: false,
        message: 'deviceToken and deviceType are required'
      });
      return;
    }

    const device = await this.notificationService.registerDevice(
      userId,
      deviceToken,
      deviceType,
      deviceName
    );
    
    res.status(201).json({
      success: true,
      message: 'Device registered',
      data: device
    });
  });

  unregisterDevice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { deviceToken } = req.body;
    if (!deviceToken) {
      res.status(400).json({
        success: false,
        message: 'deviceToken is required'
      });
      return;
    }
    await this.notificationService.unregisterDevice(deviceToken);
    res.json({
      success: true,
      message: 'Device unregistered'
    });
  });

  // ===== Send Push =====
  sendPush = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: SendPushDTO = req.body;
    await this.notificationService.sendPushNotification(data);
    res.json({
      success: true,
      message: 'Push notification sent'
    });
  });
}