import { Router } from 'express';
import { MissionController } from '../controllers/mission.controller';
import { MissionRepository } from '../repositories/mission.repository';
import { MissionService } from '../services/mission.service';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { DriverRepository } from '../../drivers/repositories/driver.repository';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const missionRepo = new MissionRepository();
const vehicleRepo = new VehicleRepository();
const driverRepo = new DriverRepository();
const missionService = new MissionService(missionRepo, vehicleRepo, driverRepo);
const missionController = new MissionController(missionService);

// Public routes (require authentication)
router.get('/', authenticate, requirePageAccess('missions'), missionController.getAll);
router.get('/vehicle/:vehicleId', authenticate, requirePageAccess('missions'), missionController.getByVehicle);
router.get('/driver/:driverId', authenticate, requirePageAccess('missions'), missionController.getByDriver);
router.get('/status/:status', authenticate, requirePageAccess('missions'), missionController.getByStatus);
router.get('/:id', authenticate, requirePageAccess('missions'), missionController.getOne);

// Protected routes (require admin/fleet_manager)
router.post('/', authenticate, requireEditAccess('missions'), missionController.create);
router.put('/:id', authenticate, requireEditAccess('missions'), missionController.update);
router.delete('/:id', authenticate, requireEditAccess('missions'), missionController.delete);
router.post('/:id/start', authenticate, requireEditAccess('missions'), missionController.start);
router.post('/:id/complete', authenticate, requireEditAccess('missions'), missionController.complete);
router.post('/:id/cancel', authenticate, requireEditAccess('missions'), missionController.cancel);

export { router as missionRouter };