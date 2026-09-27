import { Router } from 'express';
import { InsuranceController } from '../controllers/insurance.controller';
import { InsuranceRepository } from '../repositories/insurance.repository';
import { InsuranceService } from '../services/insurance.service';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const insuranceRepo = new InsuranceRepository();
const insuranceService = new InsuranceService(insuranceRepo);
const insuranceController = new InsuranceController(insuranceService);

// ===== Insurance Routes =====

// Public routes (require authentication)
router.get('/', authenticate, requirePageAccess('insurance'), insuranceController.getAll);
router.get('/active', authenticate, requirePageAccess('insurance'), insuranceController.getActive);
router.get('/expired', authenticate, requirePageAccess('insurance'), insuranceController.getExpired);
router.get('/expiring/:days', authenticate, requirePageAccess('insurance'), insuranceController.getExpiringSoon);
router.get('/status/:status', authenticate, requirePageAccess('insurance'), insuranceController.getByStatus);
router.get('/vehicle/:vehicleId', authenticate, requirePageAccess('insurance'), insuranceController.getByVehicle);
router.get('/vehicle/:vehicleId/active', authenticate, requirePageAccess('insurance'), insuranceController.getActiveByVehicle);
router.get('/:id', authenticate, requirePageAccess('insurance'), insuranceController.getOne);

// Protected routes (require admin permissions)
router.post('/', authenticate, requireEditAccess('insurance'), requirePermission('insurance:create'), insuranceController.create);
router.put('/:id', authenticate, requireEditAccess('insurance'), requirePermission('insurance:update'), insuranceController.update);
router.delete('/:id', authenticate, requireEditAccess('insurance'), requirePermission('insurance:delete'), insuranceController.delete);
router.post('/:id/renew', authenticate, requireEditAccess('insurance'), requirePermission('insurance:update'), insuranceController.renew);
router.post('/:id/cancel', authenticate, requireEditAccess('insurance'), requirePermission('insurance:update'), insuranceController.cancel);
router.post('/:id/claims', authenticate, requireEditAccess('insurance'), requirePermission('insurance:update'), insuranceController.incrementClaims);

export { router as insuranceRouter };