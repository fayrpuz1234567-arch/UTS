import { Router } from 'express';
import { WorkflowController } from '../controllers/workflow.controller';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { WorkflowService } from '../services/workflow.service';
import { authenticate, requireAdmin } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const workflowRepo = new WorkflowRepository();
const workflowService = new WorkflowService(workflowRepo);
const workflowController = new WorkflowController(workflowService);

// ===== Workflow Routes =====

// Public routes (require authentication)
router.get('/', authenticate, workflowController.getAll);
router.get('/active', authenticate, workflowController.getActive);
router.get('/module/:module', authenticate, workflowController.getByModule);
router.get('/:id', authenticate, workflowController.getOne);

// Workflow instances
router.get('/instances', authenticate, workflowController.getAllInstances);
router.get('/instances/record/:recordId', authenticate, workflowController.getByRecord);
router.get('/instances/:id', authenticate, workflowController.getInstance);
router.post('/:id/start', authenticate, requireAdmin, workflowController.startInstance);
router.post('/instances/:instanceId/steps/:stepId/approve', authenticate, requireAdmin, workflowController.approveStep);
router.post('/instances/:instanceId/steps/:stepId/reject', authenticate, requireAdmin, workflowController.rejectStep);

// Protected routes (require admin permissions)
router.post('/', authenticate, requireAdmin, requirePermission('workflow:create'), workflowController.create);
router.put('/:id', authenticate, requireAdmin, requirePermission('workflow:update'), workflowController.update);
router.delete('/:id', authenticate, requireAdmin, requirePermission('workflow:delete'), workflowController.delete);
router.post('/:id/activate', authenticate, requireAdmin, requirePermission('workflow:update'), workflowController.activate);
router.post('/:id/deactivate', authenticate, requireAdmin, requirePermission('workflow:update'), workflowController.deactivate);

export { router as workflowRouter };