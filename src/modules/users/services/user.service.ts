import { UserRepository } from '../repositories/user.repository';
import { User, CreateUserDTO, UpdateUserDTO, ChangePasswordDTO } from '../models/user.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';
import bcrypt from 'bcryptjs';

export class UserService {
  constructor(private userRepo: UserRepository) {}

  async createUser(data: CreateUserDTO, createdBy: string): Promise<User> {
    // Check if username exists
    const existingUsername = await this.userRepo.findByUsername(data.username);
    if (existingUsername) {
      throw new AppError('Username already taken', 409);
    }

    // Check if email exists
    const existingEmail = await this.userRepo.findByEmail(data.email);
    if (existingEmail) {
      throw new AppError('Email already registered', 409);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await this.userRepo.create({
      ...data,
      passwordHash,
      status: data.status || 'active',
      roles: data.roles || [],
      permissions: [],
      allowedPages: data.allowedPages || [],
      failedLoginAttempts: 0,
      sessionTimeout: 60,
      version: 1,
      isDeleted: false,
      createdBy
    });

    logger.info(`User created: ${user.username} (${user.id})`);
    return user;
  }

  async getUser(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }

  async getAllUsers(filter?: any): Promise<User[]> {
    return this.userRepo.findAll({ filter });
  }

  async updateUser(id: string, data: UpdateUserDTO, updatedBy: string): Promise<User> {
    await this.getUser(id);
    const updated = await this.userRepo.update(id, { ...data, updatedBy });
    if (!updated) {
      throw new AppError('Failed to update user', 500);
    }
    logger.info(`User updated: ${updated.username}`);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    await this.getUser(id);
    return this.userRepo.softDelete(id);
  }

  async changePassword(id: string, data: ChangePasswordDTO): Promise<User> {
    const user = await this.getUser(id);

    // Verify current password
    const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(data.newPassword, salt);

    const updated = await this.userRepo.resetPassword(id, newPasswordHash);
    if (!updated) {
      throw new AppError('Failed to change password', 500);
    }

    logger.info(`Password changed for user: ${updated.username}`);
    return updated;
  }

  // ✅ إعادة تعيين الباسورد من لوحة تحكم السوبر أدمن - من غير التحقق من
  // الباسورد القديم (لأن السوبر أدمن مش مفروض يعرف باسورد الحساب التاني أصلاً)
  async adminResetPassword(id: string, newPassword: string): Promise<User> {
    await this.getUser(id);
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    const updated = await this.userRepo.resetPassword(id, newPasswordHash);
    if (!updated) {
      throw new AppError('Failed to reset password', 500);
    }

    logger.info(`Password reset by admin for user: ${updated.username}`);
    return updated;
  }

  async updateUserStatus(id: string, status: User['status']): Promise<User> {
    await this.getUser(id);
    const updated = await this.userRepo.updateStatus(id, status);
    if (!updated) {
      throw new AppError('Failed to update status', 500);
    }
    logger.info(`User status updated: ${updated.username} -> ${updated.status}`);
    return updated;
  }

  async updateUserRoles(id: string, roles: string[]): Promise<User> {
    await this.getUser(id);
    const updated = await this.userRepo.updateRoles(id, roles);
    if (!updated) {
      throw new AppError('Failed to update roles', 500);
    }
    logger.info(`User roles updated: ${updated.username}`);
    return updated;
  }

  async updateUserPermissions(id: string, permissions: string[]): Promise<User> {
    await this.getUser(id);
    const updated = await this.userRepo.updatePermissions(id, permissions);
    if (!updated) {
      throw new AppError('Failed to update permissions', 500);
    }
    logger.info(`User permissions updated: ${updated.username}`);
    return updated;
  }

  async updateUserAllowedPages(id: string, allowedPages: string[]): Promise<User> {
    await this.getUser(id);
    const updated = await this.userRepo.updateAllowedPages(id, allowedPages);
    if (!updated) {
      throw new AppError('Failed to update allowed pages', 500);
    }
    logger.info(`User allowed pages updated: ${updated.username} -> [${allowedPages.join(', ')}]`);
    return updated;
  }

  async getUsersByStatus(status: string): Promise<User[]> {
    return this.userRepo.findByStatus(status);
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return this.userRepo.findByRole(role);
  }

  async getProfile(id: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.getUser(id);
    const { passwordHash, ...profile } = user;
    return profile;
  }
}