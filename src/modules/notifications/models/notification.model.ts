// ===== Notification Model =====
export interface Notification {
  id: string;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'reminder';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  module?: string;
  referenceId?: string;
  referenceType?: string;
  actionUrl?: string;
  targetUserId: string;
  isRead: boolean;
  readAt?: string;
  isActioned: boolean;
  actionedAt?: string;
  scheduledFor?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  isDeleted: boolean;
  metadata?: Record<string, any>;
}

export interface CreateNotificationDTO {
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  type?: 'info' | 'warning' | 'success' | 'error' | 'reminder';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  module?: string;
  referenceId?: string;
  referenceType?: string;
  actionUrl?: string;
  targetUserId: string;
  scheduledFor?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  modules: {
    [key: string]: {
      email: boolean;
      push: boolean;
      sms: boolean;
      inApp: boolean;
    };
  };
  createdAt: string;
  updatedAt: string;
  version: number;
}

// ===== Push Notification Model =====
export interface PushNotification {
  id: string;
  userId: string;
  deviceToken: string;
  deviceType: 'web' | 'android' | 'ios';
  deviceName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SendPushDTO {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
}

// ===== Email Notification Model =====
export interface EmailNotification {
  id: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
  sentAt?: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  createdAt: string;
}

export interface SendEmailDTO {
  to: string;
  subject: string;
  body: string;
  html?: string;
}