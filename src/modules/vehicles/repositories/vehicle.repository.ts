import BaseRepository from '../../../core/repositories/base.repository';
import { Vehicle } from '../models/vehicle.model';
import { logger } from '../../../core/utils/logger';

export class VehicleRepository extends BaseRepository<Vehicle> {
  constructor() {
    super('vehicles');
  }

  async findByPlateNumber(plateNumber: string): Promise<Vehicle | null> {
    return this.findOne({ plateNumber });
  }

  async findByInternalCode(internalCode: string): Promise<Vehicle | null> {
    return this.findOne({ internalCode });
  }

  async findByChassisNumber(chassisNumber: string): Promise<Vehicle | null> {
    return this.findOne({ chassisNumber });
  }

  async findByEngineNumber(engineNumber: string): Promise<Vehicle | null> {
    return this.findOne({ engineNumber });
  }

  async findByStatus(status: string): Promise<Vehicle[]> {
    return this.findAll({ filter: { status } });
  }

  async findAvailable(): Promise<Vehicle[]> {
    return this.findAll({ 
      filter: { status: 'available', isActive: true } 
    });
  }

  async updateKM(vehicleId: string, newKM: number): Promise<Vehicle | null> {
    return this.update(vehicleId, {
      currentKM: newKM,
      lastKMUpdate: new Date().toISOString()
    });
  }

  async updateStatus(vehicleId: string, status: Vehicle['status']): Promise<Vehicle | null> {
    return this.update(vehicleId, { status });
  }

  async assignDriver(vehicleId: string, driverId: string): Promise<Vehicle | null> {
    return this.update(vehicleId, { assignedDriverId: driverId });
  }

  async unassignDriver(vehicleId: string): Promise<Vehicle | null> {
    return this.update(vehicleId, { assignedDriverId: undefined });
  }
}