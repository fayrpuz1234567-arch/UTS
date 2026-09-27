import { DriverRepository } from '../repositories/driver.repository';
import { Driver, CreateDriverDTO, UpdateDriverDTO } from '../models/driver.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';
import { MissionRepository } from '../../missions/repositories/mission.repository';
import { RentalRepository } from '../../rentals/repositories/rental.repository';

export class DriverService {
  private missionRepo: MissionRepository;
  private rentalRepo: RentalRepository;

  constructor(private driverRepo: DriverRepository) {
    // ✅ FIX: نفس فكرة VehicleService.getRelatedStats - نحسب إحصائيات
    // المأموريات/الإيجارات المرتبطة بالسائق هنا مباشرة عشان تشتغل حتى لو
    // الأكونت معاه صلاحية "السائقين" بس من غير صلاحية على موديولات تانية.
    this.missionRepo = new MissionRepository();
    this.rentalRepo = new RentalRepository();
  }

  async createDriver(data: CreateDriverDTO): Promise<Driver> {
    // Check if national ID exists
    const existingNationalId = await this.driverRepo.findByNationalId(data.nationalId);
    if (existingNationalId) {
      throw new AppError('Driver with this national ID already exists', 409);
    }

    // Check if license number exists
    const existingLicense = await this.driverRepo.findByLicenseNumber(data.licenseNumber);
    if (existingLicense) {
      throw new AppError('Driver with this license number already exists', 409);
    }

    const driver = await this.driverRepo.create({
      ...data,
      status: 'active',
      isActive: true,
      version: 1
    });

    logger.info(`Driver created: ${driver.fullName} (${driver.id})`);
    return driver;
  }

  async getDriver(id: string): Promise<Driver> {
    const driver = await this.driverRepo.findById(id);
    if (!driver) {
      throw new AppError('Driver not found', 404);
    }
    return driver;
  }

  async getAllDrivers(filter?: any): Promise<Driver[]> {
    return this.driverRepo.findAll({ filter });
  }

  async updateDriver(id: string, data: UpdateDriverDTO): Promise<Driver> {
    const driver = await this.getDriver(id);

    if (data.licenseNumber && data.licenseNumber !== driver.licenseNumber) {
      const existing = await this.driverRepo.findByLicenseNumber(data.licenseNumber);
      if (existing) {
        throw new AppError('Driver with this license number already exists', 409);
      }
    }

    const updated = await this.driverRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update driver', 500);
    }

    logger.info(`Driver updated: ${updated.fullName} (${updated.id})`);
    return updated;
  }

  async deleteDriver(id: string): Promise<boolean> {
    await this.getDriver(id);
    const result = await this.driverRepo.softDelete(id);
    logger.info(`Driver deleted: ${id}`);
    return result;
  }

  async updateDriverStatus(id: string, status: Driver['status']): Promise<Driver> {
    await this.getDriver(id);

    const validStatuses: Driver['status'][] = ['active', 'inactive', 'suspended', 'terminated', 'on_leave', 'training'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const updated = await this.driverRepo.updateStatus(id, status);
    if (!updated) {
      throw new AppError('Failed to update status', 500);
    }

    logger.info(`Driver status updated: ${updated.fullName} - ${updated.status}`);
    return updated;
  }

  async assignVehicle(driverId: string, vehicleId: string): Promise<Driver> {
    await this.getDriver(driverId);

    // Check if driver already has a vehicle
    const driver = await this.driverRepo.findById(driverId);
    if (driver?.assignedVehicleId) {
      throw new AppError('Driver is already assigned to a vehicle', 400);
    }

    const updated = await this.driverRepo.assignVehicle(driverId, vehicleId);
    if (!updated) {
      throw new AppError('Failed to assign vehicle', 500);
    }

    logger.info(`Vehicle assigned to driver: ${updated.fullName} - ${vehicleId}`);
    return updated;
  }

  async unassignVehicle(driverId: string): Promise<Driver> {
    await this.getDriver(driverId);

    const updated = await this.driverRepo.unassignVehicle(driverId);
    if (!updated) {
      throw new AppError('Failed to unassign vehicle', 500);
    }

    logger.info(`Vehicle unassigned from driver: ${updated.fullName}`);
    return updated;
  }

  async getAvailableDrivers(): Promise<Driver[]> {
    return this.driverRepo.findAvailable();
  }

  async getDriversByStatus(status: string): Promise<Driver[]> {
    return this.driverRepo.findByStatus(status);
  }

  // ============================================================
  // ✅ FIX: إحصائيات السائقين المرتبطة (مأموريات/إيجارات) - نفس فكرة
  // getRelatedStats في VehicleService. راجع الشرح هناك.
  // ============================================================
  async getRelatedStats(driverIds?: string[]): Promise<Record<string, {
    missionsCount: number;
    missions: Array<{ number: string; date: string; status: string; totalKM: number; fuelCost: number; entity: string; vehicle: string }>;
    rentalsCount: number;
    rentals: Array<{ number: string; startDate: string; endDate: string; status: string; total: number; entity: string; vehicle: string }>;
  }>> {
    const [missions, rentals] = await Promise.all([
      this.missionRepo.findAll({}),
      this.rentalRepo.findAll({})
    ]);

    const ids = driverIds && driverIds.length
      ? driverIds
      : Array.from(new Set([
          ...missions.map((m: any) => m.driverId),
          ...rentals.map((r: any) => r.driverId)
        ].filter(Boolean)));

    const result: Record<string, any> = {};

    ids.forEach(id => {
      const driverMissions = missions.filter((m: any) => m.driverId === id);
      const driverRentals = rentals.filter((r: any) => r.driverId === id);

      result[id] = {
        missionsCount: driverMissions.length,
        activeMissions: driverMissions.filter((m: any) => m.status === 'active').length,
        missions: driverMissions.map((m: any) => ({
          number: m.missionNumber || m.orderNumber || 'N/A',
          date: m.startDate || m.createdAt || '',
          status: m.status || '',
          totalKM: m.totalKM || 0,
          fuelCost: m.fuelCost || 0,
          entity: m.entityName || '',
          vehicle: m.vehiclePlateNumber || m.vehicleId || ''
        })),
        rentalsCount: driverRentals.length,
        rentals: driverRentals.map((r: any) => ({
          number: r.rentalNumber || r.orderNumber || 'N/A',
          startDate: r.startDate || '',
          endDate: r.endDate || '',
          status: r.status || '',
          total: r.total || r.rentalValue || 0,
          entity: r.entityName || '',
          vehicle: r.vehiclePlateNumber || r.vehicleId || ''
        }))
      };
    });

    return result;
  }
}