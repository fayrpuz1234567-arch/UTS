import { Request, Response } from 'express';
import { ViolationService } from '../services/violation.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateViolationDTO, UpdateViolationDTO } from '../models/violations.model';

export class ViolationController {
  constructor(private violationService: ViolationService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateViolationDTO = req.body;
    const userId = req.user?.id || 'system';
    const violation = await this.violationService.createViolation(data, userId);
    res.status(201).json({
      success: true,
      message: 'Violation created successfully',
      data: violation
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const violation = await this.violationService.getViolation(id);
    res.json({ success: true, data: violation });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, type, vehicleId, driverId, paymentStatus } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (vehicleId) filter.vehicleId = vehicleId;
    if (driverId) filter.driverId = driverId;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const violations = await this.violationService.getAllViolations(filter);
    res.json({ success: true, data: violations, count: violations.length });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateViolationDTO = req.body;
    const userId = req.user?.id || 'system';
    const violation = await this.violationService.updateViolation(id, data, userId);
    res.json({
      success: true,
      message: 'Violation updated successfully',
      data: violation
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.violationService.deleteViolation(id);
    res.json({ success: true, message: 'Violation deleted successfully' });
  });

  getByVehicle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { vehicleId } = req.params;
    const violations = await this.violationService.getViolationsByVehicle(vehicleId);
    res.json({ success: true, data: violations, count: violations.length });
  });

  getByDriver = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { driverId } = req.params;
    const violations = await this.violationService.getViolationsByDriver(driverId);
    res.json({ success: true, data: violations, count: violations.length });
  });

  getByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;
    const violations = await this.violationService.getViolationsByStatus(status);
    res.json({ success: true, data: violations, count: violations.length });
  });

  getByType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type } = req.params;
    const violations = await this.violationService.getViolationsByType(type);
    res.json({ success: true, data: violations, count: violations.length });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id || 'system';

    if (!status) {
      res.status(400).json({ success: false, message: 'status is required' });
      return;
    }

    const validStatuses = ['pending', 'resolved', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
      return;
    }

    const violation = await this.violationService.updateStatus(id, status as any, userId);
    res.json({
      success: true,
      message: 'Violation status updated successfully',
      data: violation
    });
  });

  pay = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { amount, paymentDate } = req.body;
    const userId = req.user?.id || 'system';

    if (!amount || !paymentDate) {
      res.status(400).json({
        success: false,
        message: 'amount and paymentDate are required'
      });
      return;
    }

    const violation = await this.violationService.payViolation(id, Number(amount), paymentDate, userId);
    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: violation
    });
  });

  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.violationService.getStats();
    res.json({ success: true, data: stats });
  });
}