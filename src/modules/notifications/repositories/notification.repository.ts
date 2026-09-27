import BaseRepository from '../../../core/repositories/base.repository';
import { Notification, NotificationPreference, PushNotification } from '../models/notification.model';

// ===== Notification Repository =====
export class NotificationRepository extends BaseRepository<Notification> {
  constructor() {
    super('notifications');
  }

  async findByUser(userId: string): Promise<Notification[]> {
    return this.findAll({
      filter: { targetUserId: userId },
      sort: { createdAt: 'desc' }
    });
  }

  async findUnreadByUser(userId: string): Promise<Notification[]> {
    return this.findAll({
      filter: { targetUserId: userId, isRead: false },
      sort: { createdAt: 'desc' }
    });
  }

  async findUnreadCount(userId: string): Promise<number> {
    return this.count({ targetUserId: userId, isRead: false });
  }

  async markAsRead(id: string): Promise<Notification | null> {
    return this.update(id, {
      isRead: true,
      readAt: new Date().toISOString()
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    const notifications = await this.findUnreadByUser(userId);
    for (const notification of notifications) {
      await this.markAsRead(notification.id);
    }
  }

  async findExpired(): Promise<Notification[]> {
    return this.findAll({
      filter: {
        expiresAt: { $lt: new Date().toISOString() },
        isDeleted: false
      }
    });
  }

  async findByModule(module: string): Promise<Notification[]> {
    return this.findAll({ filter: { module } });
  }

  async findByReference(referenceType: string, referenceId: string): Promise<Notification[]> {
    return this.findAll({
      filter: { referenceType, referenceId }
    });
  }
}

// ===== Notification Preference Repository =====
export class NotificationPreferenceRepository extends BaseRepository<NotificationPreference> {
  constructor() {
    super('notification_preferences');
  }

  async findByUser(userId: string): Promise<NotificationPreference | null> {
    return this.findOne({ userId });
  }

  async upsert(userId: string, data: Partial<NotificationPreference>): Promise<NotificationPreference> {
    const existing = await this.findByUser(userId);
    if (existing) {
      const updated = await this.update(existing.id, data);
      return updated as NotificationPreference;
    }
    return this.create({
      userId,
      emailEnabled: true,
      pushEnabled: true,
      smsEnabled: true,
      inAppEnabled: true,
      modules: {},
      version: 1
    });
  }
}

// ===== Push Notification Device Repository =====
export class PushDeviceRepository extends BaseRepository<PushNotification> {
  constructor() {
    super('push_devices');
  }

  async findByUser(userId: string): Promise<PushNotification[]> {
    return this.findAll({
      filter: { userId, isActive: true }
    });
  }

  async findByToken(token: string): Promise<PushNotification | null> {
    return this.findOne({ deviceToken: token });
  }

  async deactivateDevice(id: string): Promise<PushNotification | null> {
    return this.update(id, { isActive: false });
  }

  async deactivateAllUserDevices(userId: string): Promise<void> {
    const devices = await this.findByUser(userId);
    for (const device of devices) {
      await this.deactivateDevice(device.id);
    }
  }
}