import { Router } from 'express';
import { PurchasingController } from '../controllers/purchasing.controller';
import {
  SupplierRepository,
  PurchaseRequestRepository,
  PurchaseOrderRepository,
  ReceivingNoteRepository
} from '../repositories/purchasing.repository';
import { PurchasingService } from '../services/purchasing.service';
import { PartRepository } from '../../inventory/repositories/inventory.repository';
import { InventoryTransactionRepository } from '../../inventory/repositories/inventory.repository';
import { WarehouseRepository } from '../../inventory/repositories/inventory.repository';
import { MaintenanceOrderRepository } from '../../maintenance/repositories/maintenance.repository';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/auth.middleware';

const router = Router();

// ============================================================
// ✅ Dependency Injection
// ============================================================
const supplierRepo = new SupplierRepository();
const requestRepo = new PurchaseRequestRepository();
const orderRepo = new PurchaseOrderRepository();
const receivingRepo = new ReceivingNoteRepository();
const partRepo = new PartRepository();
const transactionRepo = new InventoryTransactionRepository();
const warehouseRepo = new WarehouseRepository();
const maintenanceRepo = new MaintenanceOrderRepository();
const vehicleRepo = new VehicleRepository();

const purchasingService = new PurchasingService(
  supplierRepo,
  requestRepo,
  orderRepo,
  receivingRepo,
  partRepo,
  transactionRepo,
  warehouseRepo,
  maintenanceRepo,
  vehicleRepo
);
const purchasingController = new PurchasingController(purchasingService);

// ============================================================
// ===== Supplier Routes =====
// ============================================================
router.post('/suppliers', authenticate, requireEditAccess('purchasing'), purchasingController.createSupplier);
router.get('/suppliers', authenticate, requirePageAccess('purchasing'), purchasingController.getAllSuppliers);
router.get('/suppliers/active', authenticate, requirePageAccess('purchasing'), purchasingController.getActiveSuppliers);
router.get('/suppliers/taxable', authenticate, requirePageAccess('purchasing'), purchasingController.getTaxableSuppliers);
router.get('/suppliers/type/:type', authenticate, requirePageAccess('purchasing'), purchasingController.getSuppliersByType);
router.get('/suppliers/expired-commercial', authenticate, requirePageAccess('purchasing'), purchasingController.getExpiredCommercialRegisterSuppliers);
router.get('/suppliers/stats', authenticate, requirePageAccess('purchasing'), purchasingController.getSupplierStats);
router.get('/suppliers/:id', authenticate, requirePageAccess('purchasing'), purchasingController.getSupplier);
router.get('/suppliers/:id/check-expiry', authenticate, requirePageAccess('purchasing'), purchasingController.checkCommercialRegisterExpiry);
router.put('/suppliers/:id', authenticate, requireEditAccess('purchasing'), purchasingController.updateSupplier);
router.put('/suppliers/:id/rating', authenticate, requireEditAccess('purchasing'), purchasingController.updateSupplierRating);
router.delete('/suppliers/:id', authenticate, requireEditAccess('purchasing'), purchasingController.deleteSupplier);

// ============================================================
// ===== Purchase Request Routes =====
// ============================================================
router.post('/requests', authenticate, requireEditAccess('purchasing'), purchasingController.createPurchaseRequest);
router.get('/requests', authenticate, requirePageAccess('purchasing'), purchasingController.getAllPurchaseRequests);
router.get('/requests/maintenance/:maintenanceOrderId', authenticate, requirePageAccess('purchasing'), purchasingController.getPurchaseRequestsByMaintenance);
router.get('/requests/:id', authenticate, requirePageAccess('purchasing'), purchasingController.getPurchaseRequest);
router.get('/requests/:id/with-maintenance', authenticate, requirePageAccess('purchasing'), purchasingController.getPurchaseRequestWithMaintenance);
router.put('/requests/:id', authenticate, requireEditAccess('purchasing'), purchasingController.updatePurchaseRequest);
router.post('/requests/:id/approve', authenticate, requireEditAccess('purchasing'), purchasingController.approvePurchaseRequest);
router.post('/requests/:id/reject', authenticate, requireEditAccess('purchasing'), purchasingController.rejectPurchaseRequest);
router.delete('/requests/:id', authenticate, requireEditAccess('purchasing'), purchasingController.deletePurchaseRequest);

// ✅✅✅ NEW: Create Purchase Order from Approved Request
router.post('/requests/:id/create-order', authenticate, requireEditAccess('purchasing'), purchasingController.createOrderFromRequest);

// ✅✅✅ NEW: Check and sync purchase request with maintenance
router.post('/requests/:requestId/check-and-sync', authenticate, requireEditAccess('purchasing'), purchasingController.checkAndSyncPurchaseRequest);

// ============================================================
// ===== Purchase Order Routes =====
// ============================================================
router.post('/orders', authenticate, requireEditAccess('purchasing'), purchasingController.createPurchaseOrder);
router.get('/orders', authenticate, requirePageAccess('purchasing'), purchasingController.getAllPurchaseOrders);
router.get('/orders/maintenance/:maintenanceOrderId', authenticate, requirePageAccess('purchasing'), purchasingController.getPurchaseOrdersByMaintenance);
router.get('/orders/:id', authenticate, requirePageAccess('purchasing'), purchasingController.getPurchaseOrder);
router.put('/orders/:id', authenticate, requireEditAccess('purchasing'), purchasingController.updatePurchaseOrder);
router.delete('/orders/:id', authenticate, requireEditAccess('purchasing'), purchasingController.deletePurchaseOrder);
router.post('/orders/:id/confirm', authenticate, requireEditAccess('purchasing'), purchasingController.confirmPurchaseOrder);
router.post('/orders/:id/cancel', authenticate, requireEditAccess('purchasing'), purchasingController.cancelPurchaseOrder);

// ============================================================
// ===== Receiving Note Routes =====
// ============================================================
router.post('/receiving', authenticate, requireEditAccess('purchasing'), purchasingController.createReceivingNote);
router.get('/receiving', authenticate, requirePageAccess('purchasing'), purchasingController.getAllReceivingNotes);
router.get('/receiving/order/:orderId', authenticate, requirePageAccess('purchasing'), purchasingController.getReceivingNotesByOrder);
router.get('/receiving/:id', authenticate, requirePageAccess('purchasing'), purchasingController.getReceivingNote);
router.put('/receiving/:id', authenticate, requireEditAccess('purchasing'), purchasingController.updateReceivingNote);
router.post('/receiving/:id/complete', authenticate, requireEditAccess('purchasing'), purchasingController.completeReceivingNote);
router.post('/receiving/:id/cancel', authenticate, requireEditAccess('purchasing'), purchasingController.cancelReceivingNote);
router.delete('/receiving/:id', authenticate, requireEditAccess('purchasing'), purchasingController.deleteReceivingNote);

// ============================================================
// ===== Maintenance Integration Routes =====
// ============================================================
router.post('/maintenance/:maintenanceOrderId/create-request', authenticate, requireEditAccess('purchasing'), purchasingController.createPurchaseRequestFromMaintenance);
router.post('/maintenance/:maintenanceOrderId/create-order', authenticate, requireEditAccess('purchasing'), purchasingController.createPurchaseOrderFromMaintenance);
router.post('/maintenance/:maintenanceOrderId/create-receiving', authenticate, requireEditAccess('purchasing'), purchasingController.createReceivingNoteFromMaintenance);

// ✅✅✅ NEW: Maintenance Status Sync Routes
// تحديث حالة أمر الصيانة بناءً على طلب الشراء
router.put('/maintenance/:maintenanceOrderId/request-status', authenticate, requireEditAccess('purchasing'), purchasingController.updateMaintenanceRequestStatus);

// جلب حالة طلب الشراء المرتبط بأمر الصيانة
router.get('/maintenance/:maintenanceOrderId/request-status', authenticate, requirePageAccess('purchasing'), purchasingController.getMaintenancePurchaseRequestStatus);

// مزامنة أمر الصيانة مع المشتريات بالكامل
router.post('/maintenance/:maintenanceOrderId/sync', authenticate, requireEditAccess('purchasing'), purchasingController.syncMaintenanceWithPurchasing);

// جلب أمر الصيانة المرتبط بطلب شراء محدد
router.get('/maintenance/by-request/:requestId', authenticate, requirePageAccess('purchasing'), purchasingController.getMaintenanceByPurchaseRequest);

// تحديث أمر الصيانة عند استلام قطع الغيار (من إذن الاستلام)
router.post('/maintenance/:maintenanceOrderId/receive-parts', authenticate, requireEditAccess('purchasing'), purchasingController.updateMaintenanceAfterReceiving);

export { router as purchasingRouter };