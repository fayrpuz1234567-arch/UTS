import { Router } from 'express';
import { RentalController } from '../controllers/rental.controller';
import { RentalService } from '../services/rental.service';
import { RentalRepository } from '../repositories/rental.repository';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';

const router = Router();

// ===== Dependency Injection =====
const rentalRepo = new RentalRepository();
const rentalService = new RentalService(rentalRepo);
const rentalController = new RentalController(rentalService);

// ============================================================
// ===== Rental Routes =====
// ============================================================

// Get all rentals
router.get('/', authenticate, requirePageAccess('rentals'), rentalController.getAll);

// Get rental by ID
router.get('/:id', authenticate, requirePageAccess('rentals'), rentalController.getOne);

// Create rental
router.post('/', authenticate, requireEditAccess('rentals'), rentalController.create);

// Update rental
router.put('/:id', authenticate, requireEditAccess('rentals'), rentalController.update);

// Delete rental
router.delete('/:id', authenticate, requireEditAccess('rentals'), rentalController.delete);

// Activate rental
router.post('/:id/activate', authenticate, requireEditAccess('rentals'), rentalController.activate);

// Complete rental
router.post('/:id/complete', authenticate, requireEditAccess('rentals'), rentalController.complete);

// ✅ إلغاء الإيجار
router.post('/:id/cancel', authenticate, requireEditAccess('rentals'), rentalController.cancel);

export { router as rentalsRouter };