import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { AuditService } from '../services/audit.service';
import { authenticate, requireAdmin } from '../../../core/middleware/auth.middleware';

const router = Router();

const auditService = new AuditService();
const auditController = new AuditController(auditService);

// ✅ سجل العمليات بيبان بس للسوبر أدمن (بيانات حساسة عن كل حسابات النظام)
router.get('/', authenticate, requireAdmin, auditController.getAll);
router.get('/:id', authenticate, requireAdmin, auditController.getOne);
router.delete('/:id', authenticate, requireAdmin, auditController.delete);

export { router as auditRouter };