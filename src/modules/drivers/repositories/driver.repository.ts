import BaseRepository from '../../../core/repositories/base.repository';
import { Driver } from '../models/driver.model';

export class DriverRepository extends BaseRepository<Driver> {
  constructor() {
    super('drivers');
  }

  async findByNationalId(nationalId: string): Promise<Driver | null> {
    return this.findOne({ nationalId });
  }

  async findByLicenseNumber(licenseNumber: string): Promise<Driver | null> {
    return this.findOne({ licenseNumber });
  }

  async findByPhone(phone: string): Promise<Driver | null> {
    return this.findOne({ phone });
  }

  async findByEmail(email: string): Promise<Driver | null> {
    return this.findOne({ email });
  }

  async findByStatus(status: string): Promise<Driver[]> {
    return this.findAll({ filter: { status } });
  }

  async findAvailable(): Promise<Driver[]> {
    return this.findAll({
      filter: { status: 'active', isActive: true, assignedVehicleId: null }
    });
  }

  async findAssignedToVehicle(vehicleId: string): Promise<Driver | null> {
    return this.findOne({ assignedVehicleId: vehicleId });
  }

  async assignVehicle(driverId: string, vehicleId: string): Promise<Driver | null> {
    return this.update(driverId, { assignedVehicleId: vehicleId });
  }

  async unassignVehicle(driverId: string): Promise<Driver | null> {
    return this.update(driverId, { assignedVehicleId: undefined });
  }

  async updateStatus(driverId: string, status: Driver['status']): Promise<Driver | null> {
    return this.update(driverId, { status });
  }
}