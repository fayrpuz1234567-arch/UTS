import { Request, Response } from 'express';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { RentalService } from '../services/rental.service';

export class RentalController {
  constructor(private rentalService: RentalService) {}

  // ===== Get All Rentals =====
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const rentals = await this.rentalService.getAllRentals();
    res.json({ success: true, data: rentals });
  });

  // ===== Get Rental by ID =====
  getOne = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const rental = await this.rentalService.getRentalById(id);
    res.json({ success: true, data: rental });
  });

  // ===== Create Rental =====
  create = asyncHandler(async (req: Request, res: Response) => {
    const data = req.body;
    const rental = await this.rentalService.createRental(data);
    res.status(201).json({ success: true, message: 'Rental created', data: rental });
  });

  // ===== Update Rental =====
  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    const rental = await this.rentalService.updateRental(id, data);
    res.json({ success: true, message: 'Rental updated', data: rental });
  });

  // ===== Delete Rental =====
  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.rentalService.deleteRental(id);
    res.json({ success: true, message: 'Rental deleted' });
  });

  // ===== Activate Rental =====
  activate = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const rental = await this.rentalService.activateRental(id);
    res.json({ success: true, message: 'Rental activated', data: rental });
  });

  // ===== Complete Rental =====
  // ✅ إنهاء الإيجار بحالات (منتهي / ملغي / متأخر) مع تثبيت الأيام والإجمالي
  complete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, actualEndDate, endKM, days, overnight, driverAllowance, endReason, endNotes } = req.body || {};
    const rental = await this.rentalService.completeRental(id, {
      status,
      actualEndDate,
      endKM: endKM !== undefined ? Number(endKM) : undefined,
      days: days !== undefined ? Number(days) : undefined,
      overnight: overnight !== undefined ? Number(overnight) : undefined,
      driverAllowance: driverAllowance !== undefined ? Number(driverAllowance) : undefined,
      endReason,
      endNotes,
    });
    res.json({ success: true, message: 'تم إنهاء الإيجار', data: rental });
  });

  // ✅ إلغاء الإيجار
  cancel = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    const rental = await this.rentalService.cancelRental(id, reason);
    res.json({ success: true, message: 'تم إلغاء الإيجار', data: rental });
  });
}