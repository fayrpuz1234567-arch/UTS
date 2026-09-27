import { SettingsRepository } from '../repositories/settings.repository';
import { Setting, CreateSettingDTO, UpdateSettingDTO } from '../models/settings.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';

export class SettingsService {
  constructor(private settingsRepo: SettingsRepository) {}

  async createSetting(data: CreateSettingDTO, createdBy: string): Promise<Setting> {
    const existing = await this.settingsRepo.findByKey(data.key);
    if (existing) {
      throw new AppError('Setting with this key already exists', 409);
    }

    const setting = await this.settingsRepo.create({
      ...data,
      isEditable: data.isEditable !== undefined ? data.isEditable : true,
      isEncrypted: data.isEncrypted || false,
      order: data.order || 0,
      version: 1,
      isDeleted: false,
      updatedBy: createdBy
    });

    logger.info(`Setting created: ${setting.key}`);
    return setting;
  }

  async getSetting(id: string): Promise<Setting> {
    const setting = await this.settingsRepo.findById(id);
    if (!setting) {
      throw new AppError('Setting not found', 404);
    }
    return setting;
  }

  async getSettingByKey(key: string): Promise<Setting | null> {
    return this.settingsRepo.findByKey(key);
  }

  async getValue(key: string, defaultValue?: any): Promise<any> {
    const value = await this.settingsRepo.getValue(key);
    return value !== undefined && value !== null ? value : defaultValue;
  }

  async getAllSettings(): Promise<Setting[]> {
    return this.settingsRepo.findAll();
  }

  async getSettingsByCategory(category: string): Promise<Setting[]> {
    return this.settingsRepo.findByCategory(category);
  }

  async getSettingsByCategoryAndGroup(category: string, group?: string): Promise<Setting[]> {
    return this.settingsRepo.getByCategoryAndGroup(category, group);
  }

  async updateSetting(id: string, data: UpdateSettingDTO, updatedBy: string): Promise<Setting> {
    const setting = await this.getSetting(id);
    if (!setting.isEditable && data.value !== undefined) {
      throw new AppError('This setting is not editable', 403);
    }

    const updated = await this.settingsRepo.update(id, { ...data, updatedBy });
    if (!updated) {
      throw new AppError('Failed to update setting', 500);
    }
    logger.info(`Setting updated: ${updated.key}`);
    return updated;
  }

  async deleteSetting(id: string): Promise<boolean> {
    await this.getSetting(id);
    return this.settingsRepo.softDelete(id);
  }

  async getPublicSettings(): Promise<Setting[]> {
    return this.settingsRepo.getPublicSettings();
  }

  async getSettingsGrouped(): Promise<Record<string, Setting[]>> {
    const settings = await this.getAllSettings();
    const grouped: Record<string, Setting[]> = {};

    for (const setting of settings) {
      const category = setting.category || 'general';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(setting);
    }

    return grouped;
  }
}