import { Router } from 'express';
import { ContractController } from '../controllers/contract.controller';
import { ContractRepository } from '../repositories/contract.repository';
import { ContractService } from '../services/contract.service';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const contractRepo = new ContractRepository();
const contractService = new ContractService(contractRepo);
const contractController = new ContractController(contractService);

// ===== Contract Routes =====

// Public routes (require authentication)
router.get('/', authenticate, requirePageAccess('contracts'), contractController.getAll);
router.get('/active', authenticate, requirePageAccess('contracts'), contractController.getActive);
router.get('/expired', authenticate, requirePageAccess('contracts'), contractController.getExpired);
router.get('/expiring/:days', authenticate, requirePageAccess('contracts'), contractController.getExpiringSoon);
router.get('/type/:type', authenticate, requirePageAccess('contracts'), contractController.getByType);
router.get('/status/:status', authenticate, requirePageAccess('contracts'), contractController.getByStatus);
router.get('/:id', authenticate, requirePageAccess('contracts'), contractController.getOne);

// Protected routes (require admin permissions)
router.post('/', authenticate, requireEditAccess('contracts'), requirePermission('contracts:create'), contractController.create);
router.put('/:id', authenticate, requireEditAccess('contracts'), requirePermission('contracts:update'), contractController.update);
router.delete('/:id', authenticate, requireEditAccess('contracts'), requirePermission('contracts:delete'), contractController.delete);
router.post('/:id/activate', authenticate, requireEditAccess('contracts'), requirePermission('contracts:update'), contractController.activate);
router.post('/:id/cancel', authenticate, requireEditAccess('contracts'), requirePermission('contracts:update'), contractController.cancel);
router.post('/:id/renew', authenticate, requireEditAccess('contracts'), requirePermission('contracts:update'), contractController.renew);

export { router as contractsRouter };