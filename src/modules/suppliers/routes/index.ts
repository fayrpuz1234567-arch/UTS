// C:\Users\Amir\fleet-erp\backend\src\modules\suppliers\routes\index.ts

import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller';
import { SupplierRepository } from '../repositories/supplier.repository';
import { SupplierService } from '../services/supplier.service';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const supplierRepo = new SupplierRepository();
const supplierService = new SupplierService(supplierRepo);
const supplierController = new SupplierController(supplierService);

// ===== Supplier Routes =====
router.post('/', authenticate, requireEditAccess('suppliers'), supplierController.createSupplier);
router.get('/', authenticate, requirePageAccess('suppliers'), supplierController.getAllSuppliers);
router.get('/active', authenticate, requirePageAccess('suppliers'), supplierController.getActiveSuppliers);
router.get('/taxable', authenticate, requirePageAccess('suppliers'), supplierController.getTaxableSuppliers);
router.get('/type/:type', authenticate, requirePageAccess('suppliers'), supplierController.getSuppliersByType);
router.get('/expired-commercial', authenticate, requirePageAccess('suppliers'), supplierController.getExpiredCommercialRegisterSuppliers);
router.get('/stats', authenticate, requirePageAccess('suppliers'), supplierController.getSupplierStats);
router.get('/:id', authenticate, requirePageAccess('suppliers'), supplierController.getSupplier);
router.get('/:id/check-expiry', authenticate, requirePageAccess('suppliers'), supplierController.checkCommercialRegisterExpiry);
router.put('/:id', authenticate, requireEditAccess('suppliers'), supplierController.updateSupplier);
router.put('/:id/rating', authenticate, requireEditAccess('suppliers'), supplierController.updateSupplierRating);
router.delete('/:id', authenticate, requireEditAccess('suppliers'), supplierController.deleteSupplier);

export { router as supplierRouter };