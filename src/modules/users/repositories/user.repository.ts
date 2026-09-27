import BaseRepository from '../../../core/repositories/base.repository';
import { User } from '../models/user.model';

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

  async findByPhone(phone: string): Promise<User | null> {
    return this.findOne({ phone });
  }

  async findByStatus(status: string): Promise<User[]> {
    return this.findAll({ filter: { status } });
  }

  async findByRole(role: string): Promise<User[]> {
    // Since roles is an array, we need a different approach
    const all = await this.findAll();
    return all.filter(user => user.roles && user.roles.includes(role));
  }

  async updateLastLogin(userId: string, ip: string, device: string): Promise<User | null> {
    return this.update(userId, {
      lastLoginAt: new Date().toISOString(),
      lastLoginIP: ip,
      lastLoginDevice: device
    });
  }

  async resetPassword(userId: string, newPasswordHash: string): Promise<User | null> {
    return this.update(userId, {
      passwordHash: newPasswordHash,
      passwordChangedAt: new Date().toISOString()
    });
  }

  async updateStatus(userId: string, status: User['status']): Promise<User | null> {
    // ✅ لما الحساب يترجع "active" (مثلاً الأدمن عمل Unlock يدوي)،
    // لازم نصفر عداد المحاولات الفاشلة ونشيل وقت القفل، وإلا أول
    // محاولة دخول غلط بعد الفتح اليدوي هتقفل الحساب تاني فورًا.
    const updates: Partial<User> = { status };
    if (status === 'active') {
      updates.failedLoginAttempts = 0;
      updates.accountLockedUntil = undefined as any;
    }
    return this.update(userId, updates);
  }

  async updateRoles(userId: string, roles: string[]): Promise<User | null> {
    return this.update(userId, { roles });
  }

  async updatePermissions(userId: string, permissions: string[]): Promise<User | null> {
    return this.update(userId, { permissions });
  }

  async updateAllowedPages(userId: string, allowedPages: string[]): Promise<User | null> {
    return this.update(userId, { allowedPages });
  }
}