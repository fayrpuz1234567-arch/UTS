import { Router } from 'express';
import { ViolationController } from '../controllers/violation.controller';
import { ViolationRepository } from '../repositories/violation.repository';
import { ViolationService } from '../services/violation.service';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { DriverRepository } from '../../drivers/repositories/driver.repository';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const violationRepo = new ViolationRepository();
const vehicleRepo = new VehicleRepository();
const driverRepo = new DriverRepository();
const violationService = new ViolationService(violationRepo, vehicleRepo, driverRepo);
const violationController = new ViolationController(violationService);

// ===== Violation Routes =====

// Public routes (require authentication)
router.get('/', authenticate, requirePageAccess('violations'), violationController.getAll);
router.get('/stats', authenticate, requirePageAccess('violations'), violationController.getStats);
router.get('/status/:status', authenticate, requirePageAccess('violations'), violationController.getByStatus);
router.get('/type/:type', authenticate, requirePageAccess('violations'), violationController.getByType);
router.get('/vehicle/:vehicleId', authenticate, requirePageAccess('violations'), violationController.getByVehicle);
router.get('/driver/:driverId', authenticate, requirePageAccess('violations'), violationController.getByDriver);
router.get('/:id', authenticate, requirePageAccess('violations'), violationController.getOne);

// Protected routes (require admin permissions)
router.post('/', authenticate, requireEditAccess('violations'), requirePermission('violations:create'), violationController.create);
router.put('/:id', authenticate, requireEditAccess('violations'), requirePermission('violations:update'), violationController.update);
router.delete('/:id', authenticate, requireEditAccess('violations'), requirePermission('violations:delete'), violationController.delete);
router.patch('/:id/status', authenticate, requireEditAccess('violations'), requirePermission('violations:update'), violationController.updateStatus);
router.post('/:id/pay', authenticate, requireEditAccess('violations'), requirePermission('violations:update'), violationController.pay);

export { router as violationsRouter };