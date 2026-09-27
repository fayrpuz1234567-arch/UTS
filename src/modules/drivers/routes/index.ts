import { Router } from 'express';
import { DriverController } from '../controllers/driver.controller';
import { DriverRepository } from '../repositories/driver.repository';
import { DriverService } from '../services/driver.service';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const driverRepo = new DriverRepository();
const driverService = new DriverService(driverRepo);
const driverController = new DriverController(driverService);

// Public routes (require authentication)
router.get('/', authenticate, requirePageAccess('drivers'), driverController.getAll);
router.get('/available', authenticate, requirePageAccess('drivers'), driverController.getAvailable);
// ✅ FIX: لازم يتحط قبل '/:id' وإلا Express هيفهم 'related-stats' كإنه :id
router.get('/related-stats', authenticate, requirePageAccess('drivers'), driverController.getRelatedStats);
router.get('/status/:status', authenticate, requirePageAccess('drivers'), driverController.getByStatus);
router.get('/:id', authenticate, requirePageAccess('drivers'), driverController.getOne);

// Protected routes (require admin/fleet_manager)
router.post('/', authenticate, requireEditAccess('drivers'), driverController.create);
router.put('/:id', authenticate, requireEditAccess('drivers'), driverController.update);
router.delete('/:id', authenticate, requireEditAccess('drivers'), driverController.delete);
router.patch('/:id/status', authenticate, requireEditAccess('drivers'), driverController.updateStatus);
router.post('/:id/assign-vehicle', authenticate, requireEditAccess('drivers'), driverController.assignVehicle);
router.delete('/:id/unassign-vehicle', authenticate, requireEditAccess('drivers'), driverController.unassignVehicle);

export { router as driverRouter };