import { Request, Response } from 'express';
import { VehicleService } from '../services/vehicle.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateVehicleDTO, UpdateVehicleDTO } from '../models/vehicle.model';

export class VehicleController {
  constructor(private vehicleService: VehicleService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateVehicleDTO = req.body;
    const vehicle = await this.vehicleService.createVehicle(data);
    
    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      data: vehicle
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const vehicle = await this.vehicleService.getVehicle(id);
    
    res.json({
      success: true,
      data: vehicle
    });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, search } = req.query;
    const filter: any = {};
    
    if (status) filter.status = status;
    if (search) filter.plateNumber = search;
    
    const vehicles = await this.vehicleService.getAllVehicles(filter);
    
    res.json({
      success: true,
      data: vehicles,
      count: vehicles.length
    });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateVehicleDTO = req.body;
    const vehicle = await this.vehicleService.updateVehicle(id, data);
    
    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      data: vehicle
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.vehicleService.deleteVehicle(id);
    
    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  });

  updateKM = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { currentKM } = req.body;
    
    if (currentKM === undefined || currentKM === null) {
      res.status(400).json({
        success: false,
        message: 'currentKM is required'
      });
      return;
    }
    
    const vehicle = await this.vehicleService.updateVehicleKM(id, Number(currentKM));
    
    res.json({
      success: true,
      message: 'Vehicle KM updated successfully',
      data: vehicle
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
    
    const validStatuses = ['available', 'in_mission', 'in_rental', 'under_maintenance', 'out_of_service', 'retired'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
      return;
    }
    
    const vehicle = await this.vehicleService.updateVehicleStatus(id, status as any);
    
    res.json({
      success: true,
      message: 'Vehicle status updated successfully',
      data: vehicle
    });
  });

  getAvailable = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const vehicles = await this.vehicleService.getAvailableVehicles();
    
    res.json({
      success: true,
      data: vehicles,
      count: vehicles.length
    });
  });

  // ✅ FIX: إحصائيات المأموريات/الإيجارات/الوقود لكل سيارة، محسوبة في
  // الباك إند مباشرة (بدون المرور على راوتس missions/rentals/fuel
  // المحمية بصلاحية صفحة منفصلة) عشان تشتغل حتى لو الأكونت معاه صلاحية
  // "السيارات" بس.
  getRelatedStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { ids } = req.query;
    const vehicleIds = typeof ids === 'string' && ids.length
      ? ids.split(',').map(id => id.trim()).filter(Boolean)
      : undefined;

    const stats = await this.vehicleService.getRelatedStats(vehicleIds);

    res.json({
      success: true,
      data: stats
    });
  });

  getByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;
    
    const validStatuses = ['available', 'in_mission', 'in_rental', 'under_maintenance', 'out_of_service', 'retired'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
      return;
    }
    
    const vehicles = await this.vehicleService.getVehiclesByStatus(status as any);
    
    res.json({
      success: true,
      data: vehicles,
      count: vehicles.length
    });
  });
}