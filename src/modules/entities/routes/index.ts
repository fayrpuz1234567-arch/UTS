// C:\Users\Amir\fleet-erp\backend\src\modules\entities\routes\index.ts

import { Router } from 'express';
import { EntityController } from '../controllers/entity.controller';
import { EntityRepository } from '../repositories/entity.repository';
import { EntityService } from '../services/entity.service';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const entityRepo = new EntityRepository();
const entityService = new EntityService(entityRepo);
const entityController = new EntityController(entityService);

// ===== Entity Routes =====
router.post('/', authenticate, requireEditAccess('entities'), entityController.createEntity);
router.get('/', authenticate, requirePageAccess('entities'), entityController.getAllEntities);
router.get('/active', authenticate, requirePageAccess('entities'), entityController.getActiveEntities);
router.get('/internal', authenticate, requirePageAccess('entities'), entityController.getInternalEntities);
router.get('/external', authenticate, requirePageAccess('entities'), entityController.getExternalEntities);
router.get('/type/:type', authenticate, requirePageAccess('entities'), entityController.getEntitiesByType);
router.get('/category/:category', authenticate, requirePageAccess('entities'), entityController.getEntitiesByCategory);
router.get('/stats', authenticate, requirePageAccess('entities'), entityController.getEntityStats);
router.get('/:id', authenticate, requirePageAccess('entities'), entityController.getEntity);
router.put('/:id', authenticate, requireEditAccess('entities'), entityController.updateEntity);
router.delete('/:id', authenticate, requireEditAccess('entities'), entityController.deleteEntity);

export { router as entityRouter };