import { Router } from 'express';
import { MaintenanceController } from '../controllers/maintenance.controller';
import {
  MaintenanceOrderRepository,
  WorkshopRepository,
  MaintenanceTypeRepository,
  ScheduledMaintenanceRepository
} from '../repositories/maintenance.repository';
import { MaintenanceService } from '../services/maintenance.service';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';
import { PurchaseRequestRepository } from '../../purchasing/repositories/purchasing.repository';
import { PurchaseOrderRepository } from '../../purchasing/repositories/purchasing.repository';
import { ReceivingNoteRepository } from '../../purchasing/repositories/purchasing.repository';
import { PartRepository } from '../../inventory/repositories/inventory.repository';
import { InventoryTransactionRepository } from '../../inventory/repositories/inventory.repository';
import { SupplierRepository } from '../../suppliers/repositories/supplier.repository';

const router = Router();

// Dependency Injection
const orderRepo = new MaintenanceOrderRepository();
const workshopRepo = new WorkshopRepository();
const typeRepo = new MaintenanceTypeRepository();
const vehicleRepo = new VehicleRepository();
const scheduledRepo = new ScheduledMaintenanceRepository();
const purchaseRequestRepo = new PurchaseRequestRepository();
const purchaseOrderRepo = new PurchaseOrderRepository();
const receivingNoteRepo = new ReceivingNoteRepository();
const partRepo = new PartRepository();
const transactionRepo = new InventoryTransactionRepository();
const supplierRepo = new SupplierRepository();

const maintenanceService = new MaintenanceService(
  orderRepo,
  workshopRepo,
  typeRepo,
  vehicleRepo,
  purchaseRequestRepo,
  purchaseOrderRepo,
  receivingNoteRepo,
  partRepo,
  transactionRepo,
  supplierRepo,
  scheduledRepo
);
const maintenanceController = new MaintenanceController(maintenanceService);

// ============================================================
// ===== Maintenance Order Routes =====
// ============================================================
router.post('/orders', authenticate, requireEditAccess('maintenance'), maintenanceController.createOrder);
router.get('/orders', authenticate, requirePageAccess('maintenance'), maintenanceController.getAllOrders);
router.get('/orders/:id', authenticate, requirePageAccess('maintenance'), maintenanceController.getOrder);
router.put('/orders/:id', authenticate, requireEditAccess('maintenance'), maintenanceController.updateOrder);
router.delete('/orders/:id', authenticate, requireEditAccess('maintenance'), maintenanceController.deleteOrder);
router.post('/orders/:id/start', authenticate, requireEditAccess('maintenance'), maintenanceController.startOrder);
router.post('/orders/:id/complete', authenticate, requireEditAccess('maintenance'), maintenanceController.completeOrder);
router.post('/orders/:id/cancel', authenticate, requireEditAccess('maintenance'), maintenanceController.cancelOrder);
router.post('/orders/:id/approve', authenticate, requireEditAccess('maintenance'), maintenanceController.approveOrder);
router.post('/orders/:id/reject', authenticate, requireEditAccess('maintenance'), maintenanceController.rejectOrder);

// ============================================================
// ===== Workshop Routes =====
// ============================================================
router.post('/workshops', authenticate, requireEditAccess('maintenance'), maintenanceController.createWorkshop);
router.get('/workshops', authenticate, requirePageAccess('maintenance'), maintenanceController.getAllWorkshops);
router.get('/workshops/:id', authenticate, requirePageAccess('maintenance'), maintenanceController.getWorkshop);
router.put('/workshops/:id', authenticate, requireEditAccess('maintenance'), maintenanceController.updateWorkshop);
router.delete('/workshops/:id', authenticate, requireEditAccess('maintenance'), maintenanceController.deleteWorkshop);

// ============================================================
// ===== Maintenance Type Routes =====
// ============================================================
router.post('/types', authenticate, requireEditAccess('maintenance'), maintenanceController.createType);
router.get('/types', authenticate, requirePageAccess('maintenance'), maintenanceController.getAllTypes);
router.get('/types/:id', authenticate, requirePageAccess('maintenance'), maintenanceController.getType);
router.put('/types/:id', authenticate, requireEditAccess('maintenance'), maintenanceController.updateType);
router.delete('/types/:id', authenticate, requireEditAccess('maintenance'), maintenanceController.deleteType);

// ============================================================
// ===== Scheduled Maintenance Routes (جديد) =====
// ============================================================
router.post('/scheduled', authenticate, requireEditAccess('maintenance'), maintenanceController.createScheduledMaintenance);
router.get('/scheduled', authenticate, requirePageAccess('maintenance'), maintenanceController.getAllScheduledMaintenance);
router.get('/scheduled/upcoming/:days', authenticate, requirePageAccess('maintenance'), maintenanceController.getUpcomingMaintenance);
router.get('/scheduled/overdue', authenticate, requirePageAccess('maintenance'), maintenanceController.getOverdueMaintenance);
router.get('/scheduled/vehicle/:vehicleId', authenticate, requirePageAccess('maintenance'), maintenanceController.getMaintenanceByVehicle);
router.get('/scheduled/stats', authenticate, requirePageAccess('maintenance'), maintenanceController.getScheduledStats);
router.get('/scheduled/:id', authenticate, requirePageAccess('maintenance'), maintenanceController.getScheduledMaintenance);
router.put('/scheduled/:id', authenticate, requireEditAccess('maintenance'), maintenanceController.updateScheduledMaintenance);
router.post('/scheduled/:id/complete', authenticate, requireEditAccess('maintenance'), maintenanceController.completeScheduledMaintenance);
router.delete('/scheduled/:id', authenticate, requireEditAccess('maintenance'), maintenanceController.deleteScheduledMaintenance);

export { router as maintenanceRouter };