// C:\Users\Amir\fleet-erp\backend\src\modules\trusts\routes\index.ts

import { Router } from 'express';
import { TrustController } from '../controllers/trust.controller';
import { TrustRepository } from '../repositories/trust.repository';
import { TrustService } from '../services/trust.service';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';
import { InventoryTransactionRepository } from '../../inventory/repositories/inventory.repository';
import { PartRepository } from '../../inventory/repositories/inventory.repository';

const router = Router();

// Dependency Injection
const trustRepo = new TrustRepository();
const transactionRepo = new InventoryTransactionRepository();
const partRepo = new PartRepository();
const trustService = new TrustService(trustRepo, transactionRepo, partRepo);
const trustController = new TrustController(trustService);

// ===== Trust Routes =====
router.post('/', authenticate, requireEditAccess('trusts'), trustController.createTrust);
router.get('/', authenticate, requirePageAccess('trusts'), trustController.getAllTrusts);
router.get('/active', authenticate, requirePageAccess('trusts'), trustController.getActiveTrusts);
router.get('/overdue', authenticate, requirePageAccess('trusts'), trustController.getOverdueTrusts);
router.get('/stats', authenticate, requirePageAccess('trusts'), trustController.getTrustStats);
router.get('/trustee/:trusteeId', authenticate, requirePageAccess('trusts'), trustController.getTrustsByTrustee);
router.get('/status/:status', authenticate, requirePageAccess('trusts'), trustController.getTrustsByStatus);
router.get('/:id', authenticate, requirePageAccess('trusts'), trustController.getTrust);
router.put('/:id', authenticate, requireEditAccess('trusts'), trustController.updateTrust);
router.post('/:id/return', authenticate, requireEditAccess('trusts'), trustController.returnTrust);
router.post('/:id/transfer', authenticate, requireEditAccess('trusts'), trustController.transferTrust);
router.post('/:id/cancel', authenticate, requireEditAccess('trusts'), trustController.cancelTrust);
router.delete('/:id', authenticate, requireEditAccess('trusts'), trustController.deleteTrust);

export { router as trustRouter };


//new new