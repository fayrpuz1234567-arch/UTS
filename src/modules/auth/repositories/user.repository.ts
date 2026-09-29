import BaseRepository from '../../../core/repositories/base.repository';
import { User } from '../models/user.model';
import { logger } from '../../../core/utils/logger';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users');
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.findOne({ username });
  }

  // ✅ FIX: نسخة تسجيل الدخول — لو القراءة فشلت فعليًا (شبكة/تايم آوت) بترمي
  // الخطأ بدل ما ترجّع null (زي findOne العادية)، عشان login() في
  // auth.service.ts يقدر يفرّق بين "المستخدم مش موجود فعلاً" (401: بيانات
  // غلط) و"تعذر الاتصال بالخادم" (503: حاول تاني) بدل ما يورّي المستخدم
  // "بياناتك غلط" وهي أصلاً صح.
  async findByUsernameOrThrow(username: string): Promise<User | null> {
    return this.findOneOrThrow({ username });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.findOne({ phone });
  }

  async updateLastLogin(userId: string, ip: string, device: string): Promise<void> {
    await this.update(userId, {
      lastLoginAt: new Date().toISOString(),
      lastLoginIP: ip,
      lastLoginDevice: device
    });
  }

  async incrementFailedAttempts(userId: string): Promise<void> {
    const user = await this.findById(userId);
    if (user) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const updates: any = { failedLoginAttempts: attempts };
      if (attempts >= 3) {
        updates.status = 'locked';
        updates.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await this.update(userId, updates);
      logger.warn(`Failed login attempts for user ${userId}: ${attempts}`);
    }
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.update(userId, {
      failedLoginAttempts: 0,
      accountLockedUntil: undefined,
      status: 'active'
    });
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const user = await this.findById(userId);
    return user?.roles || [];
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.findById(userId);
    return user?.permissions || [];
  }
}