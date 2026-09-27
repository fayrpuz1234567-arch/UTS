import { Router } from 'express';
import { RulesController } from '../controllers/rules.controller';
import { RuleRepository } from '../repositories/rules.repository';
import { RulesService } from '../services/rules.service';
import { authenticate, requireAdmin } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const ruleRepo = new RuleRepository();
const rulesService = new RulesService(ruleRepo);
const rulesController = new RulesController(rulesService);

// ===== Rules Routes =====

// Public routes (require authentication)
router.get('/', authenticate, rulesController.getAll);
router.get('/active', authenticate, rulesController.getActive);
router.get('/module/:module', authenticate, rulesController.getByModule);
router.get('/type/:type', authenticate, rulesController.getByType);
router.get('/stats', authenticate, rulesController.getStats);
router.get('/:id', authenticate, rulesController.getOne);

// Evaluation
router.post('/:id/evaluate', authenticate, requireAdmin, rulesController.evaluate);
router.post('/module/:module/evaluate', authenticate, requireAdmin, rulesController.evaluateAll);

// Protected routes (require admin permissions)
router.post('/', authenticate, requireAdmin, requirePermission('rules:create'), rulesController.create);
router.put('/:id', authenticate, requireAdmin, requirePermission('rules:update'), rulesController.update);
router.delete('/:id', authenticate, requireAdmin, requirePermission('rules:delete'), rulesController.delete);
router.post('/:id/activate', authenticate, requireAdmin, requirePermission('rules:update'), rulesController.activate);
router.post('/:id/deactivate', authenticate, requireAdmin, requirePermission('rules:update'), rulesController.deactivate);

export { router as rulesRouter };