import { Request, Response } from 'express';
import { FuelService } from '../services/fuel.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateFuelLogDTO, CreateFuelCardDTO, CreateFuelStationDTO } from '../models/fuel.model';

export class FuelController {
  constructor(private fuelService: FuelService) {}

  // ===== Fuel Log Controllers =====
  createLog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateFuelLogDTO = req.body;
    const log = await this.fuelService.createFuelLog(data);
    res.status(201).json({
      success: true,
      message: 'Fuel log created successfully',
      data: log
    });
  });

  getLog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const log = await this.fuelService.getFuelLog(id);
    res.json({ success: true, data: log });
  });

  getAllLogs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // ✅ دعم dateFrom/dateTo كمرادف لـ startDate/endDate حتى تعمل كل الفلاتر معاً
    const { vehicleId, driverId, startDate, endDate, dateFrom, dateTo, search, page, limit } = req.query;

    const effectiveStartDate = (startDate as string) || (dateFrom as string);
    const effectiveEndDate = (endDate as string) || (dateTo as string);

    // ✅ كل الفلاتر (السيارة، السائق، التاريخ، البحث) تُجمع معاً بدلاً من إلغاء بعضها البعض
    const options: any = {};
    if (search) options.search = search as string;
    if (page) options.page = parseInt(page as string);
    if (limit) options.limit = parseInt(limit as string);
    if (effectiveStartDate) options.dateFrom = effectiveStartDate;
    if (effectiveEndDate) options.dateTo = effectiveEndDate;
    if (vehicleId) options.vehicleId = vehicleId as string;
    if (driverId) options.driverId = driverId as string;

    const result = await this.fuelService.getAllFuelLogs(options);

    res.json({ success: true, ...result });
  });

  // ✅ دالة تحديث سجل الوقود
  updateLog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body;
    const log = await this.fuelService.updateFuelLog(id, data);
    res.json({
      success: true,
      message: 'Fuel log updated successfully',
      data: log
    });
  });

  // ✅ دالة حذف سجل الوقود
  deleteLog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.fuelService.deleteFuelLog(id);
    res.json({
      success: true,
      message: 'Fuel log deleted successfully'
    });
  });

  verifyLog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    const log = await this.fuelService.verifyFuelLog(id, userId);
    res.json({ success: true, message: 'Fuel log verified', data: log });
  });

  rejectLog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, message: 'reason is required' });
      return;
    }
    const log = await this.fuelService.rejectFuelLog(id, reason);
    res.json({ success: true, message: 'Fuel log rejected', data: log });
  });

  getSuspicious = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const logs = await this.fuelService.getSuspiciousLogs(); // ✅ اسم الدالة الصحيح
    res.json({ success: true, data: logs, count: logs.length });
  });

  getAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { vehicleId, startDate, endDate, period } = req.query;

    // ✅ استخدام الدالة الصحيحة
    let analytics;
    if (vehicleId) {
      // تحليلات لسيارة معينة
      const logs = await this.fuelService.getFuelLogsByVehicle(vehicleId as string);
      // حساب التحليلات يدوياً
      analytics = {
        totalFuel: logs.reduce((sum, l) => sum + (l.fuelQuantity || 0), 0),
        totalCost: logs.reduce((sum, l) => sum + (l.totalCost || 0), 0),
        totalDistance: logs.reduce((sum, l) => sum + (l.distanceSinceLastFuel || 0), 0),
        logsCount: logs.length,
      };
    } else {
      analytics = await this.fuelService.getAnalytics((period as string) || 'month');
    }

    res.json({ success: true, data: analytics });
  });

  // ===== Fuel Card Controllers =====
  createCard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateFuelCardDTO = req.body;
    const card = await this.fuelService.createFuelCard(data);
    res.status(201).json({ success: true, message: 'Fuel card created', data: card });
  });

  getCard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const card = await this.fuelService.getFuelCard(id);
    res.json({ success: true, data: card });
  });

  getAllCards = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const cards = await this.fuelService.getAllFuelCards();
    res.json({ success: true, data: cards, count: cards.length });
  });

  updateCard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body;
    const card = await this.fuelService.updateFuelCard(id, data);
    res.json({ success: true, message: 'Fuel card updated', data: card });
  });

  deleteCard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.fuelService.deleteFuelCard(id);
    res.json({ success: true, message: 'Fuel card deleted' });
  });

  // ===== Fuel Station Controllers =====
  createStation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateFuelStationDTO = req.body;
    const station = await this.fuelService.createFuelStation(data);
    res.status(201).json({ success: true, message: 'Fuel station created', data: station });
  });

  getStation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const station = await this.fuelService.getFuelStation(id);
    res.json({ success: true, data: station });
  });

  getAllStations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stations = await this.fuelService.getAllFuelStations();
    res.json({ success: true, data: stations, count: stations.length });
  });

  updateStation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body;
    const station = await this.fuelService.updateFuelStation(id, data);
    res.json({ success: true, message: 'Fuel station updated', data: station });
  });

  deleteStation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.fuelService.deleteFuelStation(id);
    res.json({ success: true, message: 'Fuel station deleted' });
  });
}