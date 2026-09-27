// C:\Users\Amir\fleet-erp\backend\src\modules\entities\services\entity.service.ts

import { EntityRepository } from '../repositories/entity.repository';
import { Entity, CreateEntityDTO, UpdateEntityDTO } from '../models/entity.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';

export class EntityService {
  constructor(private entityRepo: EntityRepository) {}

  async createEntity(data: CreateEntityDTO): Promise<Entity> {
    const existing = await this.entityRepo.findByCode(data.code);
    if (existing) {
      throw new AppError('Entity with this code already exists', 409);
    }

    const entity = await this.entityRepo.create({
      ...data,
      isActive: true,
      version: 1,
      isDeleted: false
    });

    logger.info(`Entity created: ${entity.code} (${entity.id})`);
    return entity;
  }

  async getEntity(id: string): Promise<Entity> {
    const entity = await this.entityRepo.findById(id);
    if (!entity) {
      throw new AppError('Entity not found', 404);
    }
    return entity;
  }

  async getAllEntities(filter?: any): Promise<Entity[]> {
    return this.entityRepo.findAll({ filter });
  }

  async updateEntity(id: string, data: UpdateEntityDTO): Promise<Entity> {
    await this.getEntity(id);
    const updated = await this.entityRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update entity', 500);
    }
    logger.info(`Entity updated: ${updated.code}`);
    return updated;
  }

  async deleteEntity(id: string): Promise<boolean> {
    await this.getEntity(id);
    return this.entityRepo.softDelete(id);
  }

  async getActiveEntities(): Promise<Entity[]> {
    return this.entityRepo.findActive();
  }

  async getInternalEntities(): Promise<Entity[]> {
    return this.entityRepo.findInternal();
  }

  async getExternalEntities(): Promise<Entity[]> {
    return this.entityRepo.findExternal();
  }

  async getEntitiesByType(type: string): Promise<Entity[]> {
    return this.entityRepo.findByType(type);
  }

  async getEntitiesByCategory(category: string): Promise<Entity[]> {
    return this.entityRepo.findByCategory(category);
  }

  async getEntityStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    internal: number;
    external: number;
    government: number;
    private: number;
  }> {
    const all = await this.entityRepo.findAll();
    const active = all.filter(e => e.isActive);
    const inactive = all.filter(e => !e.isActive);
    const internal = all.filter(e => e.type === 'internal');
    const external = all.filter(e => e.type === 'external');
    const government = all.filter(e => e.type === 'government');
    const privateEntities = all.filter(e => e.type === 'private');

    return {
      total: all.length,
      active: active.length,
      inactive: inactive.length,
      internal: internal.length,
      external: external.length,
      government: government.length,
      private: privateEntities.length
    };
  }
}