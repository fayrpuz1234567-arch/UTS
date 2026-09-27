import { AccidentRepository } from '../repositories/accident.repository';
import { Accident, CreateAccidentDTO, UpdateAccidentDTO } from '../models/accidents.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { DriverRepository } from '../../drivers/repositories/driver.repository';

export class AccidentService {
  constructor(
    private accidentRepo: AccidentRepository,
    private vehicleRepo: VehicleRepository,
    private driverRepo: DriverRepository
  ) {}

  async createAccident(data: CreateAccidentDTO, createdBy: string): Promise<Accident> {
    const existing = await this.accidentRepo.findByAccidentNumber(data.accidentNumber);
    if (existing) {
      throw new AppError('Accident with this number already exists', 409);
    }

    // Check if vehicle exists
    const vehicle = await this.vehicleRepo.findById(data.vehicleId);
    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }

    // Check if driver exists (if provided)
    if (data.driverId) {
      const driver = await this.driverRepo.findById(data.driverId);
      if (!driver) {
        throw new AppError('Driver not found', 404);
      }
    }

    const accident = await this.accidentRepo.create({
      ...data,
      repairStatus: 'pending',
      status: 'reported',
      version: 1,
      isDeleted: false,
      createdBy
    });

    // Update vehicle status
    await this.vehicleRepo.updateStatus(data.vehicleId, 'out_of_service');

    logger.info(`Accident created: ${accident.accidentNumber} (${accident.id})`);
    return accident;
  }

  async getAccident(id: string): Promise<Accident> {
    const accident = await this.accidentRepo.findById(id);
    if (!accident) {
      throw new AppError('Accident not found', 404);
    }
    return accident;
  }

  async getAllAccidents(filter?: any): Promise<Accident[]> {
    return this.accidentRepo.findAll({ filter });
  }

  async updateAccident(id: string, data: UpdateAccidentDTO, updatedBy: string): Promise<Accident> {
    await this.getAccident(id);
    const updated = await this.accidentRepo.update(id, { ...data, updatedBy });
    if (!updated) {
      throw new AppError('Failed to update accident', 500);
    }
    logger.info(`Accident updated: ${updated.accidentNumber}`);
    return updated;
  }

  async deleteAccident(id: string): Promise<boolean> {
    await this.getAccident(id);
    return this.accidentRepo.softDelete(id);
  }

  async getAccidentsByVehicle(vehicleId: string): Promise<Accident[]> {
    return this.accidentRepo.findByVehicle(vehicleId);
  }

  async getAccidentsByDriver(driverId: string): Promise<Accident[]> {
    return this.accidentRepo.findByDriver(driverId);
  }

  async getAccidentsByStatus(status: string): Promise<Accident[]> {
    return this.accidentRepo.findByStatus(status);
  }

  async getAccidentsBySeverity(severity: string): Promise<Accident[]> {
    return this.accidentRepo.findBySeverity(severity);
  }

  async getAccidentsByDateRange(startDate: string, endDate: string): Promise<Accident[]> {
    return this.accidentRepo.findByDateRange(startDate, endDate);
  }

  async updateStatus(id: string, status: Accident['status'], updatedBy: string): Promise<Accident> {
    const accident = await this.getAccident(id);
    const updated = await this.accidentRepo.updateStatus(id, status);
    if (!updated) {
      throw new AppError('Failed to update status', 500);
    }

    // If resolved or closed, update vehicle status
    if (status === 'resolved' || status === 'closed') {
      await this.vehicleRepo.updateStatus(accident.vehicleId, 'available');
    }

    logger.info(`Accident status updated: ${updated.accidentNumber} -> ${updated.status}`);
    return updated;
  }

  async updateRepairStatus(id: string, repairStatus: Accident['repairStatus'], updatedBy: string): Promise<Accident> {
    await this.getAccident(id);
    const updated = await this.accidentRepo.updateRepairStatus(id, repairStatus);
    if (!updated) {
      throw new AppError('Failed to update repair status', 500);
    }
    logger.info(`Accident repair status updated: ${updated.accidentNumber} -> ${updated.repairStatus}`);
    return updated;
  }

  async getStats(): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    totalCost: number;
  }> {
    return this.accidentRepo.getStats();
  }
}