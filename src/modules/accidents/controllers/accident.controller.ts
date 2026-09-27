import { Request, Response } from 'express';
import { AccidentService } from '../services/accident.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateAccidentDTO, UpdateAccidentDTO } from '../models/accidents.model';

export class AccidentController {
  constructor(private accidentService: AccidentService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateAccidentDTO = req.body;
    const userId = req.user?.id || 'system';
    const accident = await this.accidentService.createAccident(data, userId);
    res.status(201).json({
      success: true,
      message: 'Accident created successfully',
      data: accident
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const accident = await this.accidentService.getAccident(id);
    res.json({ success: true, data: accident });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, severity, vehicleId, driverId } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (vehicleId) filter.vehicleId = vehicleId;
    if (driverId) filter.driverId = driverId;

    const accidents = await this.accidentService.getAllAccidents(filter);
    res.json({ success: true, data: accidents, count: accidents.length });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateAccidentDTO = req.body;
    const userId = req.user?.id || 'system';
    const accident = await this.accidentService.updateAccident(id, data, userId);
    res.json({
      success: true,
      message: 'Accident updated successfully',
      data: accident
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.accidentService.deleteAccident(id);
    res.json({ success: true, message: 'Accident deleted successfully' });
  });

  getByVehicle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { vehicleId } = req.params;
    const accidents = await this.accidentService.getAccidentsByVehicle(vehicleId);
    res.json({ success: true, data: accidents, count: accidents.length });
  });

  getByDriver = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { driverId } = req.params;
    const accidents = await this.accidentService.getAccidentsByDriver(driverId);
    res.json({ success: true, data: accidents, count: accidents.length });
  });

  getByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;
    const accidents = await this.accidentService.getAccidentsByStatus(status);
    res.json({ success: true, data: accidents, count: accidents.length });
  });

  getBySeverity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { severity } = req.params;
    const accidents = await this.accidentService.getAccidentsBySeverity(severity);
    res.json({ success: true, data: accidents, count: accidents.length });
  });

  getByDateRange = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      res.status(400).json({ success: false, message: 'startDate and endDate are required' });
      return;
    }
    const accidents = await this.accidentService.getAccidentsByDateRange(
      startDate as string,
      endDate as string
    );
    res.json({ success: true, data: accidents, count: accidents.length });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id || 'system';

    if (!status) {
      res.status(400).json({ success: false, message: 'status is required' });
      return;
    }

    const validStatuses = ['reported', 'investigating', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
      return;
    }

    const accident = await this.accidentService.updateStatus(id, status as any, userId);
    res.json({
      success: true,
      message: 'Accident status updated successfully',
      data: accident
    });
  });

  updateRepairStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { repairStatus } = req.body;
    const userId = req.user?.id || 'system';

    if (!repairStatus) {
      res.status(400).json({ success: false, message: 'repairStatus is required' });
      return;
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'rejected'];
    if (!validStatuses.includes(repairStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid repairStatus. Must be one of: ${validStatuses.join(', ')}`
      });
      return;
    }

    const accident = await this.accidentService.updateRepairStatus(id, repairStatus as any, userId);
    res.json({
      success: true,
      message: 'Accident repair status updated successfully',
      data: accident
    });
  });

  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.accidentService.getStats();
    res.json({ success: true, data: stats });
  });
}