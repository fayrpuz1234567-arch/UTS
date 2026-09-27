// C:\Users\Amir\fleet-erp\backend\src\modules\entities\repositories\entity.repository.ts

import BaseRepository from '../../../core/repositories/base.repository';
import { Entity } from '../models/entity.model';

export class EntityRepository extends BaseRepository<Entity> {
  constructor() {
    super('entities');
  }

  async findByCode(code: string): Promise<Entity | null> {
    return this.findOne({ code });
  }

  async findByType(type: string): Promise<Entity[]> {
    return this.findAll({ filter: { type } });
  }

  async findByCategory(category: string): Promise<Entity[]> {
    return this.findAll({ filter: { category } });
  }

  async findActive(): Promise<Entity[]> {
    return this.findAll({ filter: { isActive: true } });
  }

  async findInternal(): Promise<Entity[]> {
    return this.findAll({ filter: { type: 'internal', isActive: true } });
  }

  async findExternal(): Promise<Entity[]> {
    return this.findAll({ filter: { type: 'external', isActive: true } });
  }
}