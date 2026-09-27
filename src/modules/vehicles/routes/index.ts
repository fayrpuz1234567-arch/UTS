import { Router } from 'express';
import { VehicleController } from '../controllers/vehicle.controller';
import { VehicleRepository } from '../repositories/vehicle.repository';
import { VehicleService } from '../services/vehicle.service';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const vehicleRepo = new VehicleRepository();
const vehicleService = new VehicleService(vehicleRepo);
const vehicleController = new VehicleController(vehicleService);

// Public routes (require authentication)
router.get('/', authenticate, requirePageAccess('vehicles'), vehicleController.getAll);
router.get('/available', authenticate, requirePageAccess('vehicles'), vehicleController.getAvailable);
// ✅ FIX: لازم يتحط قبل '/:id' وإلا Express هيفهم 'related-stats' كإنه :id
router.get('/related-stats', authenticate, requirePageAccess('vehicles'), vehicleController.getRelatedStats);
router.get('/status/:status', authenticate, requirePageAccess('vehicles'), vehicleController.getByStatus);
router.get('/:id', authenticate, requirePageAccess('vehicles'), vehicleController.getOne);

// Protected routes (require admin/fleet_manager)
router.post('/', authenticate, requireEditAccess('vehicles'), vehicleController.create);
router.put('/:id', authenticate, requireEditAccess('vehicles'), vehicleController.update);
router.delete('/:id', authenticate, requireEditAccess('vehicles'), vehicleController.delete);
router.patch('/:id/km', authenticate, requireEditAccess('vehicles'), vehicleController.updateKM);
router.patch('/:id/status', authenticate, requireEditAccess('vehicles'), vehicleController.updateStatus);

export { router as vehicleRouter };