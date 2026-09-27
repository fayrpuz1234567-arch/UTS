import BaseRepository from '../../../core/repositories/base.repository';
import { Accident } from '../models/accidents.model';

export class AccidentRepository extends BaseRepository<Accident> {
  constructor() {
    super('accidents');
  }

  async findByAccidentNumber(accidentNumber: string): Promise<Accident | null> {
    return this.findOne({ accidentNumber });
  }

  async findByVehicle(vehicleId: string): Promise<Accident[]> {
    return this.findAll({ filter: { vehicleId } });
  }

  async findByDriver(driverId: string): Promise<Accident[]> {
    return this.findAll({ filter: { driverId } });
  }

  async findByStatus(status: string): Promise<Accident[]> {
    return this.findAll({ filter: { status } });
  }

  async findBySeverity(severity: string): Promise<Accident[]> {
    return this.findAll({ filter: { severity } });
  }

  async findByDateRange(startDate: string, endDate: string): Promise<Accident[]> {
    return this.findAll({
      filter: {
        accidentDate: { $gte: startDate, $lte: endDate }
      }
    });
  }

  async updateStatus(id: string, status: Accident['status']): Promise<Accident | null> {
    return this.update(id, { status });
  }

  async updateRepairStatus(id: string, repairStatus: Accident['repairStatus']): Promise<Accident | null> {
    return this.update(id, { repairStatus });
  }

  async getStats(): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    totalCost: number;
  }> {
    const all = await this.findAll();
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalCost = 0;

    for (const accident of all) {
      bySeverity[accident.severity] = (bySeverity[accident.severity] || 0) + 1;
      byStatus[accident.status] = (byStatus[accident.status] || 0) + 1;
      totalCost += accident.estimatedCost || 0;
    }

    return {
      total: all.length,
      bySeverity,
      byStatus,
      totalCost
    };
  }
}