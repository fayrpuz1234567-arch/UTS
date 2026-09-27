import BaseRepository from '../../../core/repositories/base.repository';
import { Rule } from '../models/rules.model';

export class RuleRepository extends BaseRepository<Rule> {
  constructor() {
    super('rules');
  }

  async findByCode(code: string): Promise<Rule | null> {
    return this.findOne({ code });
  }

  async findByModule(module: string): Promise<Rule[]> {
    return this.findAll({ filter: { module } });
  }

  async findByType(type: string): Promise<Rule[]> {
    return this.findAll({ filter: { type } });
  }

  async findByStatus(status: string): Promise<Rule[]> {
    return this.findAll({ filter: { status } });
  }

  async findActive(): Promise<Rule[]> {
    return this.findAll({ filter: { status: 'active' } });
  }

  async findActiveByModule(module: string): Promise<Rule[]> {
    return this.findAll({
      filter: {
        module,
        status: 'active'
      }
    });
  }

  async updateStatus(id: string, status: Rule['status']): Promise<Rule | null> {
    return this.update(id, { status });
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    draft: number;
    byModule: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const all = await this.findAll();
    const active = all.filter(r => r.status === 'active');
    const inactive = all.filter(r => r.status === 'inactive');
    const draft = all.filter(r => r.status === 'draft');

    const byModule: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const rule of all) {
      byModule[rule.module] = (byModule[rule.module] || 0) + 1;
      byType[rule.type] = (byType[rule.type] || 0) + 1;
    }

    return {
      total: all.length,
      active: active.length,
      inactive: inactive.length,
      draft: draft.length,
      byModule,
      byType
    };
  }
}