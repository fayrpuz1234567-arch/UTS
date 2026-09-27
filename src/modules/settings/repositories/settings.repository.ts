import BaseRepository from '../../../core/repositories/base.repository';
import { Setting } from '../models/settings.model';

export class SettingsRepository extends BaseRepository<Setting> {
  constructor() {
    super('settings');
  }

  async findByKey(key: string): Promise<Setting | null> {
    return this.findOne({ key });
  }

  async findByCategory(category: string): Promise<Setting[]> {
    return this.findAll({ filter: { category } });
  }

  async findByGroup(group: string): Promise<Setting[]> {
    return this.findAll({ filter: { group } });
  }

  async getValue(key: string): Promise<any> {
    const setting = await this.findByKey(key);
    return setting?.value;
  }

  async setValue(key: string, value: any): Promise<Setting | null> {
    const setting = await this.findByKey(key);
    if (setting) {
      return this.update(setting.id, { value });
    }
    return null;
  }

  async getPublicSettings(): Promise<Setting[]> {
    return this.findAll({
      filter: { isEditable: true }
    });
  }

  async getByCategoryAndGroup(category: string, group?: string): Promise<Setting[]> {
    const filter: any = { category };
    if (group) filter.group = group;
    return this.findAll({ filter });
  }
}