import { Router } from 'express';
import { AccidentController } from '../controllers/accident.controller';
import { AccidentRepository } from '../repositories/accident.repository';
import { AccidentService } from '../services/accident.service';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { DriverRepository } from '../../drivers/repositories/driver.repository';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const accidentRepo = new AccidentRepository();
const vehicleRepo = new VehicleRepository();
const driverRepo = new DriverRepository();
const accidentService = new AccidentService(accidentRepo, vehicleRepo, driverRepo);
const accidentController = new AccidentController(accidentService);

// ===== Accident Routes =====

// Public routes (require authentication)
router.get('/', authenticate, requirePageAccess('accidents'), accidentController.getAll);
router.get('/stats', authenticate, requirePageAccess('accidents'), accidentController.getStats);
router.get('/status/:status', authenticate, requirePageAccess('accidents'), accidentController.getByStatus);
router.get('/severity/:severity', authenticate, requirePageAccess('accidents'), accidentController.getBySeverity);
router.get('/vehicle/:vehicleId', authenticate, requirePageAccess('accidents'), accidentController.getByVehicle);
router.get('/driver/:driverId', authenticate, requirePageAccess('accidents'), accidentController.getByDriver);
router.get('/:id', authenticate, requirePageAccess('accidents'), accidentController.getOne);

// Protected routes (require admin permissions)
router.post('/', authenticate, requireEditAccess('accidents'), requirePermission('accidents:create'), accidentController.create);
router.put('/:id', authenticate, requireEditAccess('accidents'), requirePermission('accidents:update'), accidentController.update);
router.delete('/:id', authenticate, requireEditAccess('accidents'), requirePermission('accidents:delete'), accidentController.delete);
router.patch('/:id/status', authenticate, requireEditAccess('accidents'), requirePermission('accidents:update'), accidentController.updateStatus);
router.patch('/:id/repair-status', authenticate, requireEditAccess('accidents'), requirePermission('accidents:update'), accidentController.updateRepairStatus);

export { router as accidentsRouter };