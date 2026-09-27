import { Request, Response } from 'express';
import { MissionService } from '../services/mission.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateMissionDTO, UpdateMissionDTO } from '../models/mission.model';

export class MissionController {
  constructor(private missionService: MissionService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateMissionDTO = req.body;
    const mission = await this.missionService.createMission(data);

    res.status(201).json({
      success: true,
      message: 'Mission created successfully',
      data: mission
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const mission = await this.missionService.getMission(id);

    res.json({
      success: true,
      data: mission
    });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, vehicleId, driverId, dateFrom, dateTo } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (vehicleId) filter.vehicleId = vehicleId;
    if (driverId) filter.driverId = driverId;

    let missions = await this.missionService.getAllMissions(filter);

    // Filter by date range if provided
    if (dateFrom && dateTo) {
      missions = await this.missionService.getMissionsByDateRange(
        dateFrom as string,
        dateTo as string
      );
    }

    res.json({
      success: true,
      data: missions,
      count: missions.length
    });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateMissionDTO = req.body;
    const mission = await this.missionService.updateMission(id, data);

    res.json({
      success: true,
      message: 'Mission updated successfully',
      data: mission
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.missionService.deleteMission(id);

    res.json({
      success: true,
      message: 'Mission deleted successfully'
    });
  });

  start = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const mission = await this.missionService.startMission(id);

    res.json({
      success: true,
      message: 'Mission started successfully',
      data: mission
    });
  });

  complete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { endKM } = req.body;

    if (!endKM) {
      res.status(400).json({
        success: false,
        message: 'endKM is required'
      });
      return;
    }

    const mission = await this.missionService.completeMission(id, endKM);

    res.json({
      success: true,
      message: 'Mission completed successfully',
      data: mission
    });
  });

  cancel = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({
        success: false,
        message: 'reason is required'
      });
      return;
    }

    const mission = await this.missionService.cancelMission(id, reason);

    res.json({
      success: true,
      message: 'Mission cancelled successfully',
      data: mission
    });
  });

  getByVehicle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { vehicleId } = req.params;
    const missions = await this.missionService.getMissionsByVehicle(vehicleId);

    res.json({
      success: true,
      data: missions,
      count: missions.length
    });
  });

  getByDriver = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { driverId } = req.params;
    const missions = await this.missionService.getMissionsByDriver(driverId);

    res.json({
      success: true,
      data: missions,
      count: missions.length
    });
  });

  getByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;
    const missions = await this.missionService.getMissionsByStatus(status);

    res.json({
      success: true,
      data: missions,
      count: missions.length
    });
  });
}