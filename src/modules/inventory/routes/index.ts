// C:\Users\Amir\fleet-erp\backend\src\modules\inventory\routes\index.ts

import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import {
  PartRepository,
  WarehouseRepository,
  InventoryTransactionRepository
} from '../repositories/inventory.repository';
import { InventoryService } from '../services/inventory.service';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const partRepo = new PartRepository();
const warehouseRepo = new WarehouseRepository();
const transactionRepo = new InventoryTransactionRepository();
const inventoryService = new InventoryService(partRepo, warehouseRepo, transactionRepo);
const inventoryController = new InventoryController(inventoryService);

// ===== Part Routes =====
router.post('/parts', authenticate, requireEditAccess('inventory'), inventoryController.createPart);
router.get('/parts', authenticate, requirePageAccess('inventory'), inventoryController.getAllParts);
router.get('/parts/low-stock', authenticate, requirePageAccess('inventory'), inventoryController.getLowStock);
router.get('/parts/reorder', authenticate, requirePageAccess('inventory'), inventoryController.getReorderParts);      // ✅ جديد
router.get('/parts/expired', authenticate, requirePageAccess('inventory'), inventoryController.getExpiredParts);      // ✅ جديد
router.get('/parts/alerts', authenticate, requirePageAccess('inventory'), inventoryController.getLowStockAlerts);
router.get('/parts/:id', authenticate, requirePageAccess('inventory'), inventoryController.getPart);
router.put('/parts/:id', authenticate, requireEditAccess('inventory'), inventoryController.updatePart);
router.delete('/parts/:id', authenticate, requireEditAccess('inventory'), inventoryController.deletePart);

// ===== Warehouse Routes =====
router.post('/warehouses', authenticate, requireEditAccess('inventory'), inventoryController.createWarehouse);
router.get('/warehouses', authenticate, requirePageAccess('inventory'), inventoryController.getAllWarehouses);
router.get('/warehouses/:id', authenticate, requirePageAccess('inventory'), inventoryController.getWarehouse);
router.put('/warehouses/:id', authenticate, requireEditAccess('inventory'), inventoryController.updateWarehouse);
router.delete('/warehouses/:id', authenticate, requireEditAccess('inventory'), inventoryController.deleteWarehouse);

// ===== Transaction Routes =====
router.post('/transactions', authenticate, requireEditAccess('inventory'), inventoryController.createTransaction);
router.get('/transactions', authenticate, requirePageAccess('inventory'), inventoryController.getAllTransactions);
router.get('/transactions/by-reference', authenticate, requirePageAccess('inventory'), inventoryController.getTransactionsByReference); // ✅ جديد
router.get('/transactions/part-movements', authenticate, requirePageAccess('inventory'), inventoryController.getPartMovements);         // ✅ جديد
router.get('/transactions/by-type-date', authenticate, requirePageAccess('inventory'), inventoryController.getTransactionsByTypeAndDate); // ✅ جديد
router.get('/transactions/maintenance/:maintenanceOrderId', authenticate, requirePageAccess('inventory'), inventoryController.getMaintenanceTransactions); // ✅ جديد
router.get('/transactions/purchase/:purchaseOrderId', authenticate, requirePageAccess('inventory'), inventoryController.getPurchaseTransactions); // ✅ جديد
router.get('/transactions/:id', authenticate, requirePageAccess('inventory'), inventoryController.getTransaction);
router.post('/transactions/:id/approve', authenticate, requireEditAccess('inventory'), inventoryController.approveTransaction);
router.post('/transactions/:id/reject', authenticate, requireEditAccess('inventory'), inventoryController.rejectTransaction);

// ===== Inventory Stats =====
router.get('/stats', authenticate, requirePageAccess('inventory'), inventoryController.getInventoryStats); // ✅ جديد

// ===== Inventory Count =====
router.post('/count/:partId', authenticate, requireEditAccess('inventory'), inventoryController.countInventory); // ✅ جديد

export { router as inventoryRouter };