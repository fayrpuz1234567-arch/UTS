import BaseRepository from '../../../core/repositories/base.repository';
import { Mission } from '../models/mission.model';

export class MissionRepository extends BaseRepository<Mission> {
  constructor() {
    super('missions');
  }

  async findByMissionNumber(missionNumber: string): Promise<Mission | null> {
    return this.findOne({ missionNumber });
  }

  async findByVehicle(vehicleId: string): Promise<Mission[]> {
    return this.findAll({ filter: { vehicleId } });
  }

  async findByDriver(driverId: string): Promise<Mission[]> {
    return this.findAll({ filter: { driverId } });
  }

  async findByStatus(status: string): Promise<Mission[]> {
    return this.findAll({ filter: { status } });
  }

  async findActiveByVehicle(vehicleId: string): Promise<Mission[]> {
    return this.findAll({
      filter: { vehicleId, status: 'active' }
    });
  }

  async findActiveByDriver(driverId: string): Promise<Mission[]> {
    return this.findAll({
      filter: { driverId, status: 'active' }
    });
  }

  async updateStatus(id: string, status: Mission['status']): Promise<Mission | null> {
    return this.update(id, { status });
  }

  async completeMission(id: string, endKM: number, totalKM: number): Promise<Mission | null> {
    return this.update(id, {
      status: 'completed',
      endKM,
      totalKM,
      completedAt: new Date().toISOString()
    });
  }

  async cancelMission(id: string, reason: string): Promise<Mission | null> {
    return this.update(id, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: new Date().toISOString()
    });
  }

  async getMissionsByDateRange(startDate: string, endDate: string): Promise<Mission[]> {
    return this.findAll({
      filter: {
        startDate: { $gte: startDate, $lte: endDate }
      }
    });
  }
}