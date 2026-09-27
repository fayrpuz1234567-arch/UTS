import { Router } from 'express';
import { FuelController } from '../controllers/fuel.controller';
import { FuelLogRepository, FuelCardRepository, FuelStationRepository } from '../repositories/fuel.repository';
import { FuelService } from '../services/fuel.service';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { DriverRepository } from '../../drivers/repositories/driver.repository';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const fuelLogRepo = new FuelLogRepository();
const fuelCardRepo = new FuelCardRepository();
const fuelStationRepo = new FuelStationRepository();
const vehicleRepo = new VehicleRepository();
const driverRepo = new DriverRepository();
const fuelService = new FuelService(
  fuelLogRepo,
  fuelCardRepo,
  fuelStationRepo,
  vehicleRepo,
  driverRepo
);
const fuelController = new FuelController(fuelService);

// ===== Fuel Log Routes =====
router.post('/logs', authenticate, requireEditAccess('fuel'), fuelController.createLog);
router.get('/logs', authenticate, requirePageAccess('fuel'), fuelController.getAllLogs);
router.get('/logs/suspicious', authenticate, requirePageAccess('fuel'), fuelController.getSuspicious);
router.get('/logs/:id', authenticate, requirePageAccess('fuel'), fuelController.getLog);
router.put('/logs/:id', authenticate, requireEditAccess('fuel'), fuelController.updateLog);      // ✅ إضافة Route التحديث
router.delete('/logs/:id', authenticate, requireEditAccess('fuel'), fuelController.deleteLog);  // ✅ إضافة Route الحذف
router.patch('/logs/:id/verify', authenticate, requireEditAccess('fuel'), fuelController.verifyLog);
router.patch('/logs/:id/reject', authenticate, requireEditAccess('fuel'), fuelController.rejectLog);
router.get('/analytics', authenticate, requirePageAccess('fuel'), fuelController.getAnalytics);

// ===== Fuel Card Routes =====
router.post('/cards', authenticate, requireEditAccess('fuel'), fuelController.createCard);
router.get('/cards', authenticate, requirePageAccess('fuel'), fuelController.getAllCards);
router.get('/cards/:id', authenticate, requirePageAccess('fuel'), fuelController.getCard);
router.put('/cards/:id', authenticate, requireEditAccess('fuel'), fuelController.updateCard);
router.delete('/cards/:id', authenticate, requireEditAccess('fuel'), fuelController.deleteCard);

// ===== Fuel Station Routes =====
router.post('/stations', authenticate, requireEditAccess('fuel'), fuelController.createStation);
router.get('/stations', authenticate, requirePageAccess('fuel'), fuelController.getAllStations);
router.get('/stations/:id', authenticate, requirePageAccess('fuel'), fuelController.getStation);
router.put('/stations/:id', authenticate, requireEditAccess('fuel'), fuelController.updateStation);
router.delete('/stations/:id', authenticate, requireEditAccess('fuel'), fuelController.deleteStation);

// ✅ التصدير الصحيح
export { router as fuelRouter };