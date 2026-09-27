import { MissionRepository } from '../repositories/mission.repository';
import { Mission, CreateMissionDTO, UpdateMissionDTO } from '../models/mission.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { DriverRepository } from '../../drivers/repositories/driver.repository';

export class MissionService {
  constructor(
    private missionRepo: MissionRepository,
    private vehicleRepo: VehicleRepository,
    private driverRepo: DriverRepository
  ) {}

  async createMission(data: CreateMissionDTO): Promise<Mission> {
    // Check if mission number exists
    const existing = await this.missionRepo.findByMissionNumber(data.missionNumber);
    if (existing) {
      throw new AppError('Mission with this number already exists', 409);
    }

    // ✅ المركبة والسائق أصبحا اختياريين وقت الإنشاء (مثلاً من التقويم قبل ما تتحدد التفاصيل):
    // لو اتبعتوا، نتأكد إنهم موجودين ومتاحين؛ لو مبعتوش، نكمّل الإنشاء من غيرهم
    // ويكمّلهم المستخدم لاحقًا (السجل هيفضل "ناقص البيانات" لحد ما يتحدثوا).
    if (data.vehicleId) {
      const vehicle = await this.vehicleRepo.findById(data.vehicleId);
      if (!vehicle) {
        throw new AppError('Vehicle not found', 404);
      }
      if (vehicle.status !== 'available') {
        throw new AppError('Vehicle is not available for mission', 400);
      }

      // Check if vehicle has active mission
      const activeVehicleMissions = await this.missionRepo.findActiveByVehicle(data.vehicleId);
      if (activeVehicleMissions.length > 0) {
        throw new AppError('Vehicle already has an active mission', 400);
      }
    }

    if (data.driverId) {
      const driver = await this.driverRepo.findById(data.driverId);
      if (!driver) {
        throw new AppError('Driver not found', 404);
      }
      if (driver.status !== 'active') {
        throw new AppError('Driver is not active', 400);
      }

      // Check if driver has active mission
      const activeDriverMissions = await this.missionRepo.findActiveByDriver(data.driverId);
      if (activeDriverMissions.length > 0) {
        throw new AppError('Driver already has an active mission', 400);
      }
    }

    // Update vehicle status (فقط لو المركبة متحددة)
    if (data.vehicleId) {
      await this.vehicleRepo.updateStatus(data.vehicleId, 'in_mission');
    }

    const mission = await this.missionRepo.create({
      ...data,
      vehicleId: data.vehicleId || '',
      driverId: data.driverId || '',
      priority: data.priority || 'normal',
      status: 'scheduled',
      isActive: true,
      version: 1
    });

    logger.info(`Mission created: ${mission.missionNumber} (${mission.id})`);
    return mission;
  }

  async getMission(id: string): Promise<Mission> {
    const mission = await this.missionRepo.findById(id);
    if (!mission) {
      throw new AppError('Mission not found', 404);
    }
    return mission;
  }

  async getAllMissions(filter?: any): Promise<Mission[]> {
    return this.missionRepo.findAll({ filter });
  }

  async updateMission(id: string, data: UpdateMissionDTO): Promise<Mission> {
    await this.getMission(id);

    const updated = await this.missionRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update mission', 500);
    }

    logger.info(`Mission updated: ${updated.missionNumber} (${updated.id})`);
    return updated;
  }

  async deleteMission(id: string): Promise<boolean> {
    await this.getMission(id);
    const result = await this.missionRepo.softDelete(id);
    logger.info(`Mission deleted: ${id}`);
    return result;
  }

  async startMission(id: string): Promise<Mission> {
    const mission = await this.getMission(id);

    if (mission.status !== 'scheduled') {
      throw new AppError('Mission cannot be started. Status must be scheduled', 400);
    }

    const updated = await this.missionRepo.updateStatus(id, 'active');
    if (!updated) {
      throw new AppError('Failed to start mission', 500);
    }

    // Update vehicle status (فقط لو فيه مركبة مرتبطة بالمأمورية)
    if (mission.vehicleId) {
      await this.vehicleRepo.updateStatus(mission.vehicleId, 'in_mission');
    }

    logger.info(`Mission started: ${updated.missionNumber}`);
    return updated;
  }

  async completeMission(id: string, endKM: number): Promise<Mission> {
    const mission = await this.getMission(id);

    if (mission.status !== 'active') {
      throw new AppError('Mission cannot be completed. Status must be active', 400);
    }

    if (endKM < mission.startKM) {
      throw new AppError('End KM cannot be less than Start KM', 400);
    }

    const totalKM = endKM - mission.startKM;

    const updated = await this.missionRepo.completeMission(id, endKM, totalKM);
    if (!updated) {
      throw new AppError('Failed to complete mission', 500);
    }

    // Update vehicle status and KM (فقط لو فيه مركبة مرتبطة بالمأمورية)
    if (mission.vehicleId) {
      await this.vehicleRepo.updateStatus(mission.vehicleId, 'available');
      await this.vehicleRepo.updateKM(mission.vehicleId, endKM);
    }

    logger.info(`Mission completed: ${updated.missionNumber} - Total KM: ${totalKM}`);
    return updated;
  }

  async cancelMission(id: string, reason: string): Promise<Mission> {
    const mission = await this.getMission(id);

    if (mission.status === 'completed') {
      throw new AppError('Cannot cancel a completed mission', 400);
    }

    const updated = await this.missionRepo.cancelMission(id, reason);
    if (!updated) {
      throw new AppError('Failed to cancel mission', 500);
    }

    // Update vehicle status (فقط لو فيه مركبة مرتبطة بالمأمورية)
    if (mission.vehicleId) {
      await this.vehicleRepo.updateStatus(mission.vehicleId, 'available');
    }

    logger.info(`Mission cancelled: ${updated.missionNumber}`);
    return updated;
  }

  async getMissionsByVehicle(vehicleId: string): Promise<Mission[]> {
    return this.missionRepo.findByVehicle(vehicleId);
  }

  async getMissionsByDriver(driverId: string): Promise<Mission[]> {
    return this.missionRepo.findByDriver(driverId);
  }

  async getMissionsByStatus(status: string): Promise<Mission[]> {
    return this.missionRepo.findByStatus(status);
  }

  async getMissionsByDateRange(startDate: string, endDate: string): Promise<Mission[]> {
    return this.missionRepo.getMissionsByDateRange(startDate, endDate);
  }
}