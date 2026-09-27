// C:\Users\Amir\fleet-erp\backend\src\modules\entities\controllers\entity.controller.ts

import { Request, Response } from 'express';
import { EntityService } from '../services/entity.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateEntityDTO, UpdateEntityDTO } from '../models/entity.model';

export class EntityController {
  constructor(private entityService: EntityService) {}

  createEntity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateEntityDTO = req.body;
    const entity = await this.entityService.createEntity(data);
    res.status(201).json({ success: true, message: 'Entity created', data: entity });
  });

  getEntity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const entity = await this.entityService.getEntity(id);
    res.json({ success: true, data: entity });
  });

  getAllEntities = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type, category, isActive } = req.query;
    let filter: any = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const entities = await this.entityService.getAllEntities(filter);
    res.json({ success: true, data: entities, count: entities.length });
  });

  updateEntity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateEntityDTO = req.body;
    const entity = await this.entityService.updateEntity(id, data);
    res.json({ success: true, message: 'Entity updated', data: entity });
  });

  deleteEntity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.entityService.deleteEntity(id);
    res.json({ success: true, message: 'Entity deleted' });
  });

  getActiveEntities = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const entities = await this.entityService.getActiveEntities();
    res.json({ success: true, data: entities, count: entities.length });
  });

  getInternalEntities = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const entities = await this.entityService.getInternalEntities();
    res.json({ success: true, data: entities, count: entities.length });
  });

  getExternalEntities = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const entities = await this.entityService.getExternalEntities();
    res.json({ success: true, data: entities, count: entities.length });
  });

  getEntitiesByType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type } = req.params;
    const entities = await this.entityService.getEntitiesByType(type);
    res.json({ success: true, data: entities, count: entities.length });
  });

  getEntitiesByCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { category } = req.params;
    const entities = await this.entityService.getEntitiesByCategory(category);
    res.json({ success: true, data: entities, count: entities.length });
  });

  getEntityStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.entityService.getEntityStats();
    res.json({ success: true, data: stats });
  });
}