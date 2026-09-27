import { Request, Response } from 'express';
import { MaintenanceService } from '../services/maintenance.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { 
  CreateMaintenanceDTO, 
  UpdateMaintenanceDTO, 
  CreateWorkshopDTO,
  CreateScheduledMaintenanceDTO,
  UpdateScheduledMaintenanceDTO
} from '../models/maintenance.model';

export class MaintenanceController {
  constructor(private maintenanceService: MaintenanceService) {}

  // ===== Maintenance Order Controllers =====
  createOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateMaintenanceDTO = req.body;
    const order = await this.maintenanceService.createOrder(data);
    res.status(201).json({
      success: true,
      message: 'Maintenance order created successfully',
      data: order
    });
  });

  getOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const order = await this.maintenanceService.getOrder(id);
    res.json({ success: true, data: order });
  });

  getAllOrders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, vehicleId } = req.query;
    let orders = [];
    if (vehicleId) {
      orders = await this.maintenanceService.getOrdersByVehicle(vehicleId as string);
    } else if (status) {
      orders = await this.maintenanceService.getOrdersByStatus(status as string);
    } else {
      orders = await this.maintenanceService.getAllOrders();
    }
    res.json({ success: true, data: orders, count: orders.length });
  });

  updateOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateMaintenanceDTO = req.body;
    const order = await this.maintenanceService.updateOrder(id, data);
    res.json({ success: true, message: 'Order updated', data: order });
  });

  deleteOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.maintenanceService.deleteOrder(id);
    res.json({ success: true, message: 'Order deleted' });
  });

  startOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const order = await this.maintenanceService.startOrder(id);
    res.json({ success: true, message: 'Order started', data: order });
  });

  completeOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { endKM, totalCost } = req.body;
    if (!endKM) {
      res.status(400).json({ success: false, message: 'endKM is required' });
      return;
    }
    const order = await this.maintenanceService.completeOrder(id, endKM, totalCost || 0);
    res.json({ success: true, message: 'Order completed', data: order });
  });

  cancelOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, message: 'reason is required' });
      return;
    }
    const order = await this.maintenanceService.cancelOrder(id, reason);
    res.json({ success: true, message: 'Order cancelled', data: order });
  });

  approveOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    const order = await this.maintenanceService.approveOrder(id, userId);
    res.json({ success: true, message: 'Order approved', data: order });
  });

  rejectOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, message: 'reason is required' });
      return;
    }
    const order = await this.maintenanceService.rejectOrder(id, reason);
    res.json({ success: true, message: 'Order rejected', data: order });
  });

  // ===== Workshop Controllers =====
  createWorkshop = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateWorkshopDTO = req.body;
    const workshop = await this.maintenanceService.createWorkshop(data);
    res.status(201).json({ success: true, message: 'Workshop created', data: workshop });
  });

  getWorkshop = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const workshop = await this.maintenanceService.getWorkshop(id);
    res.json({ success: true, data: workshop });
  });

  getAllWorkshops = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const workshops = await this.maintenanceService.getAllWorkshops();
    res.json({ success: true, data: workshops, count: workshops.length });
  });

  updateWorkshop = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body;
    const workshop = await this.maintenanceService.updateWorkshop(id, data);
    res.json({ success: true, message: 'Workshop updated', data: workshop });
  });

  deleteWorkshop = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.maintenanceService.deleteWorkshop(id);
    res.json({ success: true, message: 'Workshop deleted' });
  });

  // ===== Maintenance Type Controllers =====
  createType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = req.body;
    const type = await this.maintenanceService.createMaintenanceType(data);
    res.status(201).json({ success: true, message: 'Maintenance type created', data: type });
  });

  getType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const type = await this.maintenanceService.getMaintenanceType(id);
    res.json({ success: true, data: type });
  });

  getAllTypes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const types = await this.maintenanceService.getAllMaintenanceTypes();
    res.json({ success: true, data: types, count: types.length });
  });

  updateType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body;
    const type = await this.maintenanceService.updateMaintenanceType(id, data);
    res.json({ success: true, message: 'Maintenance type updated', data: type });
  });

  deleteType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.maintenanceService.deleteMaintenanceType(id);
    res.json({ success: true, message: 'Maintenance type deleted' });
  });

  // ============================================================
  // ===== Scheduled Maintenance Controllers (جديد) =====
  // ============================================================

  createScheduledMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateScheduledMaintenanceDTO = req.body;
    const scheduled = await this.maintenanceService.createScheduledMaintenance(data);
    res.status(201).json({ success: true, message: 'Scheduled maintenance created', data: scheduled });
  });

  getScheduledMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const scheduled = await this.maintenanceService.getScheduledMaintenance(id);
    res.json({ success: true, data: scheduled });
  });

  getAllScheduledMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { vehicleId, status } = req.query;
    let filter: any = {};
    if (vehicleId) filter.vehicleId = vehicleId;
    if (status) filter.status = status;
    const scheduled = await this.maintenanceService.getAllScheduledMaintenance(filter);
    res.json({ success: true, data: scheduled, count: scheduled.length });
  });

  updateScheduledMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateScheduledMaintenanceDTO = req.body;
    const scheduled = await this.maintenanceService.updateScheduledMaintenance(id, data);
    res.json({ success: true, message: 'Scheduled maintenance updated', data: scheduled });
  });

  deleteScheduledMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.maintenanceService.deleteScheduledMaintenance(id);
    res.json({ success: true, message: 'Scheduled maintenance deleted' });
  });

  getUpcomingMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { days } = req.params;
    const scheduled = await this.maintenanceService.getUpcomingMaintenance(parseInt(days) || 7);
    res.json({ success: true, data: scheduled, count: scheduled.length });
  });

  getOverdueMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const scheduled = await this.maintenanceService.getOverdueMaintenance();
    res.json({ success: true, data: scheduled, count: scheduled.length });
  });

  getMaintenanceByVehicle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { vehicleId } = req.params;
    const scheduled = await this.maintenanceService.getMaintenanceByVehicle(vehicleId);
    res.json({ success: true, data: scheduled, count: scheduled.length });
  });

  completeScheduledMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { maintenanceOrderId, actualDate, lastPerformedKM } = req.body;
    
    if (!maintenanceOrderId || !actualDate || lastPerformedKM === undefined) {
      res.status(400).json({ 
        success: false, 
        message: 'maintenanceOrderId, actualDate and lastPerformedKM are required' 
      });
      return;
    }
    
    const scheduled = await this.maintenanceService.completeScheduledMaintenance(
      id,
      maintenanceOrderId,
      actualDate,
      lastPerformedKM
    );
    res.json({ success: true, message: 'Scheduled maintenance completed', data: scheduled });
  });

  getScheduledStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.maintenanceService.getScheduledStats();
    res.json({ success: true, data: stats });
  });
}