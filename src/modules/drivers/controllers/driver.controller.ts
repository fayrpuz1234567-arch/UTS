import { Request, Response } from 'express';
import { DriverService } from '../services/driver.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateDriverDTO, UpdateDriverDTO } from '../models/driver.model';

export class DriverController {
  constructor(private driverService: DriverService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateDriverDTO = req.body;
    const driver = await this.driverService.createDriver(data);

    res.status(201).json({
      success: true,
      message: 'Driver created successfully',
      data: driver
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const driver = await this.driverService.getDriver(id);

    res.json({
      success: true,
      data: driver
    });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, search } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { fullName: search },
        { nationalId: search },
        { phone: search }
      ];
    }

    const drivers = await this.driverService.getAllDrivers(filter);

    res.json({
      success: true,
      data: drivers,
      count: drivers.length
    });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateDriverDTO = req.body;
    const driver = await this.driverService.updateDriver(id, data);

    res.json({
      success: true,
      message: 'Driver updated successfully',
      data: driver
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.driverService.deleteDriver(id);

    res.json({
      success: true,
      message: 'Driver deleted successfully'
    });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({
        success: false,
        message: 'status is required'
      });
      return;
    }

    const validStatuses = ['active', 'inactive', 'suspended', 'terminated', 'on_leave', 'training'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
      return;
    }

    const driver = await this.driverService.updateDriverStatus(id, status as any);

    res.json({
      success: true,
      message: 'Driver status updated successfully',
      data: driver
    });
  });

  assignVehicle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { vehicleId } = req.body;

    if (!vehicleId) {
      res.status(400).json({
        success: false,
        message: 'vehicleId is required'
      });
      return;
    }

    const driver = await this.driverService.assignVehicle(id, vehicleId);

    res.json({
      success: true,
      message: 'Vehicle assigned to driver successfully',
      data: driver
    });
  });

  unassignVehicle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const driver = await this.driverService.unassignVehicle(id);

    res.json({
      success: true,
      message: 'Vehicle unassigned from driver successfully',
      data: driver
    });
  });

  getAvailable = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const drivers = await this.driverService.getAvailableDrivers();

    res.json({
      success: true,
      data: drivers,
      count: drivers.length
    });
  });

  // ✅ FIX: إحصائيات المأموريات/الإيجارات لكل سائق، محسوبة في الباك إند
  // مباشرة بدون المرور على راوتس missions/rentals المحمية بصلاحية صفحة
  // منفصلة - راجع الشرح في VehicleController.getRelatedStats.
  getRelatedStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { ids } = req.query;
    const driverIds = typeof ids === 'string' && ids.length
      ? ids.split(',').map(id => id.trim()).filter(Boolean)
      : undefined;

    const stats = await this.driverService.getRelatedStats(driverIds);

    res.json({
      success: true,
      data: stats
    });
  });

  getByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;

    const validStatuses = ['active', 'inactive', 'suspended', 'terminated', 'on_leave', 'training'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
      return;
    }

    const drivers = await this.driverService.getDriversByStatus(status);

    res.json({
      success: true,
      data: drivers,
      count: drivers.length
    });
  });
}