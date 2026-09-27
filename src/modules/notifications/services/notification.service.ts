import {
  NotificationRepository,
  NotificationPreferenceRepository,
  PushDeviceRepository
} from '../repositories/notification.repository';
import {
  Notification,
  CreateNotificationDTO,
  NotificationPreference,
  PushNotification,
  SendPushDTO,
  SendEmailDTO
} from '../models/notification.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';

// Firebase Admin مستخدم هنا فقط لإرسال الإشعارات (FCM) - مش قاعدة البيانات
import { getMessaging } from '../../../core/config/messaging.config';

// ✅ استيراد الريبوزتوري للموردين والمركبات والسائقين
import { SupplierRepository } from '../../suppliers/repositories/supplier.repository';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { DriverRepository } from '../../drivers/repositories/driver.repository';
import { PartRepository } from '../../inventory/repositories/inventory.repository';

export class NotificationService {
  constructor(
    private notificationRepo: NotificationRepository,
    private preferenceRepo: NotificationPreferenceRepository,
    private deviceRepo: PushDeviceRepository,
    // ✅ إضافة الريبوزتوري المطلوبة للتحذيرات
    private supplierRepo?: SupplierRepository,
    private vehicleRepo?: VehicleRepository,
    private driverRepo?: DriverRepository,
    private partRepo?: PartRepository
  ) {}

  // ============================================================
  // ===== Create Notification =====
  // ============================================================
  async createNotification(data: CreateNotificationDTO): Promise<Notification> {
    const notification = await this.notificationRepo.create({
      ...data,
      type: data.type || 'info',
      priority: data.priority || 'medium',
      isRead: false,
      isActioned: false,
      isDeleted: false
    });

    logger.info(`Notification created for user ${data.targetUserId}: ${notification.id}`);
    
    // Send push notification if enabled
    await this.sendPushIfEnabled(notification);

    return notification;
  }

  // ============================================================
  // ===== Get Notifications =====
  // ============================================================
  async getNotifications(userId: string, options?: { limit?: number; offset?: number }): Promise<Notification[]> {
    return this.notificationRepo.findByUser(userId);
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return this.notificationRepo.findUnreadByUser(userId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.findUnreadCount(userId);
  }

  // ============================================================
  // ===== Mark as Read =====
  // ============================================================
  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.notificationRepo.findById(id);
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }
    const updated = await this.notificationRepo.markAsRead(id);
    if (!updated) {
      throw new AppError('Failed to mark notification as read', 500);
    }
    return updated;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.markAllAsRead(userId);
    logger.info(`All notifications marked as read for user ${userId}`);
  }

  // ============================================================
  // ===== Delete Notification =====
  // ============================================================
  async deleteNotification(id: string): Promise<boolean> {
    const notification = await this.notificationRepo.findById(id);
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }
    return this.notificationRepo.softDelete(id);
  }

  // ============================================================
  // ===== Notification Preferences =====
  // ============================================================
  async getPreferences(userId: string): Promise<NotificationPreference> {
    let prefs = await this.preferenceRepo.findByUser(userId);
    if (!prefs) {
      prefs = await this.preferenceRepo.upsert(userId, {});
    }
    return prefs;
  }

  async updatePreferences(userId: string, data: Partial<NotificationPreference>): Promise<NotificationPreference> {
    return this.preferenceRepo.upsert(userId, data);
  }

  // ============================================================
  // ===== Push Notifications =====
  // ============================================================
  async registerDevice(userId: string, deviceToken: string, deviceType: string, deviceName?: string): Promise<PushNotification> {
    const existing = await this.deviceRepo.findByToken(deviceToken);
    if (existing) {
      return existing;
    }

    return this.deviceRepo.create({
      userId,
      deviceToken,
      deviceType: deviceType as any,
      deviceName,
      isActive: true
    });
  }

  async unregisterDevice(deviceToken: string): Promise<void> {
    const device = await this.deviceRepo.findByToken(deviceToken);
    if (device) {
      await this.deviceRepo.deactivateDevice(device.id);
    }
  }

  async sendPushNotification(data: SendPushDTO): Promise<void> {
    const devices = await this.deviceRepo.findByUser(data.userId);
    if (devices.length === 0) return;

    const messaging = getMessaging();

    for (const device of devices) {
      try {
        await messaging.send({
          token: device.deviceToken,
          notification: {
            title: data.title,
            body: data.body,
            imageUrl: data.imageUrl
          },
          data: data.data || {}
        });
        logger.info(`Push notification sent to device ${device.id}`);
      } catch (error) {
        logger.error(`Failed to send push to device ${device.id}: ${error}`);
        await this.deviceRepo.deactivateDevice(device.id);
      }
    }
  }

  private async sendPushIfEnabled(notification: Notification): Promise<void> {
    const prefs = await this.getPreferences(notification.targetUserId);
    if (prefs.pushEnabled) {
      const modulePref = prefs.modules?.[notification.module || 'default'];
      if (modulePref && !modulePref.push) return;

      await this.sendPushNotification({
        userId: notification.targetUserId,
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification.id,
          module: notification.module || '',
          referenceId: notification.referenceId || '',
          referenceType: notification.referenceType || ''
        }
      });
    }
  }

  // ============================================================
  // ===== System Alert Notifications =====
  // ============================================================

  // ✅ 1. التحذير عند انتهاء السجل التجاري للموردين
  async checkSuppliersCommercialRegister(): Promise<void> {
    if (!this.supplierRepo) {
      logger.warn('SupplierRepository not available for notification check');
      return;
    }

    try {
      const expiredSuppliers = await this.supplierRepo.findExpiredCommercialRegister();
      
      for (const supplier of expiredSuppliers) {
        await this.createNotification({
          title: 'انتهاء السجل التجاري للمورد',
          titleAr: 'انتهاء السجل التجاري للمورد',
          body: `السجل التجاري للمورد ${supplier.name} منتهي في ${supplier.commercialRegisterExpiry}`,
          bodyAr: `السجل التجاري للمورد ${supplier.name} منتهي في ${supplier.commercialRegisterExpiry}`,
          type: 'warning',
          priority: 'high',
          targetUserId: 'admin',
          module: 'suppliers',
          referenceId: supplier.id,
          referenceType: 'supplier',
          metadata: { supplierId: supplier.id }
        });
      }
      
      if (expiredSuppliers.length > 0) {
        logger.info(`Found ${expiredSuppliers.length} suppliers with expired commercial register`);
      }
    } catch (error) {
      logger.error('Error checking suppliers commercial register:', error);
    }
  }

  // ✅ 2. التحذير عند انتهاء رخصة السيارة
  async checkVehiclesLicenseExpiry(): Promise<void> {
    if (!this.vehicleRepo) {
      logger.warn('VehicleRepository not available for notification check');
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const allVehicles = await this.vehicleRepo.findAll();
      
      // تصفية السيارات المنتهية الرخصة
      const expiredVehicles = allVehicles.filter(v => 
        v.licenseExpiry && v.licenseExpiry <= today
      );
      
      // تصفية السيارات التي على وشك الانتهاء (خلال 30 يوم)
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];
      
      const expiringVehicles = allVehicles.filter(v => 
        v.licenseExpiry && v.licenseExpiry > today && v.licenseExpiry <= thirtyDaysLaterStr
      );

      // إشعارات للسيارات المنتهية
      for (const vehicle of expiredVehicles) {
        await this.createNotification({
          title: 'انتهاء رخصة السيارة',
          titleAr: 'انتهاء رخصة السيارة',
          body: `رخصة السيارة ${vehicle.plateNumber} منتهية في ${vehicle.licenseExpiry}`,
          bodyAr: `رخصة السيارة ${vehicle.plateNumber} منتهية في ${vehicle.licenseExpiry}`,
          type: 'error',
          priority: 'urgent',
          targetUserId: 'admin',
          module: 'vehicles',
          referenceId: vehicle.id,
          referenceType: 'vehicle',
          metadata: { vehicleId: vehicle.id }
        });
      }

      // إشعارات للسيارات التي على وشك الانتهاء
      for (const vehicle of expiringVehicles) {
        await this.createNotification({
          title: 'رخصة السيارة على وشك الانتهاء',
          titleAr: 'رخصة السيارة على وشك الانتهاء',
          body: `رخصة السيارة ${vehicle.plateNumber} تنتهي في ${vehicle.licenseExpiry}`,
          bodyAr: `رخصة السيارة ${vehicle.plateNumber} تنتهي في ${vehicle.licenseExpiry}`,
          type: 'warning',
          priority: 'high',
          targetUserId: 'admin',
          module: 'vehicles',
          referenceId: vehicle.id,
          referenceType: 'vehicle',
          metadata: { vehicleId: vehicle.id }
        });
      }
      
      if (expiredVehicles.length > 0 || expiringVehicles.length > 0) {
        logger.info(`Vehicles: ${expiredVehicles.length} expired, ${expiringVehicles.length} expiring soon`);
      }
    } catch (error) {
      logger.error('Error checking vehicles license expiry:', error);
    }
  }

  // ✅ 3. التحذير عند انتهاء رخصة السائق
  async checkDriversLicenseExpiry(): Promise<void> {
    if (!this.driverRepo) {
      logger.warn('DriverRepository not available for notification check');
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const allDrivers = await this.driverRepo.findAll();
      
      const expiredDrivers = allDrivers.filter(d => 
        d.licenseExpiry && d.licenseExpiry <= today
      );
      
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];
      
      const expiringDrivers = allDrivers.filter(d => 
        d.licenseExpiry && d.licenseExpiry > today && d.licenseExpiry <= thirtyDaysLaterStr
      );

      for (const driver of expiredDrivers) {
        await this.createNotification({
          title: 'انتهاء رخصة السائق',
          titleAr: 'انتهاء رخصة السائق',
          body: `رخصة السائق ${driver.fullName} منتهية في ${driver.licenseExpiry}`,
          bodyAr: `رخصة السائق ${driver.fullName} منتهية في ${driver.licenseExpiry}`,
          type: 'error',
          priority: 'urgent',
          targetUserId: 'admin',
          module: 'drivers',
          referenceId: driver.id,
          referenceType: 'driver',
          metadata: { driverId: driver.id }
        });
      }

      for (const driver of expiringDrivers) {
        await this.createNotification({
          title: 'رخصة السائق على وشك الانتهاء',
          titleAr: 'رخصة السائق على وشك الانتهاء',
          body: `رخصة السائق ${driver.fullName} تنتهي في ${driver.licenseExpiry}`,
          bodyAr: `رخصة السائق ${driver.fullName} تنتهي في ${driver.licenseExpiry}`,
          type: 'warning',
          priority: 'high',
          targetUserId: 'admin',
          module: 'drivers',
          referenceId: driver.id,
          referenceType: 'driver',
          metadata: { driverId: driver.id }
        });
      }
      
      if (expiredDrivers.length > 0 || expiringDrivers.length > 0) {
        logger.info(`Drivers: ${expiredDrivers.length} expired, ${expiringDrivers.length} expiring soon`);
      }
    } catch (error) {
      logger.error('Error checking drivers license expiry:', error);
    }
  }

  // ✅ 4. التحذير عند انخفاض المخزون
  async checkLowStockParts(): Promise<void> {
    if (!this.partRepo) {
      logger.warn('PartRepository not available for notification check');
      return;
    }

    try {
      const lowStockParts = await this.partRepo.findLowStock();
      const outOfStockParts = await this.partRepo.findOutOfStock();

      for (const part of lowStockParts) {
        await this.createNotification({
          title: 'مخزون منخفض',
          titleAr: 'مخزون منخفض',
          body: `المخزون من القطعة ${part.name} منخفض: ${part.currentStock} / ${part.minimumStock}`,
          bodyAr: `المخزون من القطعة ${part.name} منخفض: ${part.currentStock} / ${part.minimumStock}`,
          type: 'warning',
          priority: 'high',
          targetUserId: 'admin',
          module: 'inventory',
          referenceId: part.id,
          referenceType: 'part',
          metadata: { partId: part.id, currentStock: part.currentStock, minimumStock: part.minimumStock }
        });
      }

      for (const part of outOfStockParts) {
        await this.createNotification({
          title: 'نفاد المخزون',
          titleAr: 'نفاد المخزون',
          body: `القطعة ${part.name} نفدت من المخزون`,
          bodyAr: `القطعة ${part.name} نفدت من المخزون`,
          type: 'error',
          priority: 'urgent',
          targetUserId: 'admin',
          module: 'inventory',
          referenceId: part.id,
          referenceType: 'part',
          metadata: { partId: part.id }
        });
      }
      
      if (lowStockParts.length > 0 || outOfStockParts.length > 0) {
        logger.info(`Parts: ${lowStockParts.length} low stock, ${outOfStockParts.length} out of stock`);
      }
    } catch (error) {
      logger.error('Error checking low stock parts:', error);
    }
  }

  // ✅ 5. تشغيل جميع التحذيرات دفعة واحدة
  async runAllSystemChecks(): Promise<void> {
    logger.info('Running all system checks...');
    
    await this.checkSuppliersCommercialRegister();
    await this.checkVehiclesLicenseExpiry();
    await this.checkDriversLicenseExpiry();
    await this.checkLowStockParts();
    
    logger.info('All system checks completed');
  }

  // ============================================================
  // ===== Email Notifications (Placeholder) =====
  // ============================================================
  async sendEmail(data: SendEmailDTO): Promise<void> {
    logger.info(`Email would be sent to ${data.to}: ${data.subject}`);
  }

  // ============================================================
  // ===== SMS Notifications (Placeholder) =====
  // ============================================================
  async sendSMS(phone: string, message: string): Promise<void> {
    logger.info(`SMS would be sent to ${phone}: ${message}`);
  }
}