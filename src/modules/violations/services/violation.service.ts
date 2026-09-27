import { ViolationRepository } from '../repositories/violation.repository';
import { Violation, CreateViolationDTO, UpdateViolationDTO } from '../models/violations.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { DriverRepository } from '../../drivers/repositories/driver.repository';

export class ViolationService {
  constructor(
    private violationRepo: ViolationRepository,
    private vehicleRepo: VehicleRepository,
    private driverRepo: DriverRepository
  ) {}

  async createViolation(data: CreateViolationDTO, createdBy: string): Promise<Violation> {
    const existing = await this.violationRepo.findByViolationNumber(data.violationNumber);
    if (existing) {
      throw new AppError('Violation with this number already exists', 409);
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

    const violation = await this.violationRepo.create({
      ...data,
      paidAmount: 0,
      paymentStatus: 'unpaid',
      status: 'pending',
      version: 1,
      isDeleted: false,
      createdBy
    });

    logger.info(`Violation created: ${violation.violationNumber} (${violation.id})`);
    return violation;
  }

  async getViolation(id: string): Promise<Violation> {
    const violation = await this.violationRepo.findById(id);
    if (!violation) {
      throw new AppError('Violation not found', 404);
    }
    return violation;
  }

  async getAllViolations(filter?: any): Promise<Violation[]> {
    return this.violationRepo.findAll({ filter });
  }

  async updateViolation(id: string, data: UpdateViolationDTO, updatedBy: string): Promise<Violation> {
    await this.getViolation(id);
    const updated = await this.violationRepo.update(id, { ...data, updatedBy });
    if (!updated) {
      throw new AppError('Failed to update violation', 500);
    }
    logger.info(`Violation updated: ${updated.violationNumber}`);
    return updated;
  }

  async deleteViolation(id: string): Promise<boolean> {
    await this.getViolation(id);
    return this.violationRepo.softDelete(id);
  }

  async getViolationsByVehicle(vehicleId: string): Promise<Violation[]> {
    return this.violationRepo.findByVehicle(vehicleId);
  }

  async getViolationsByDriver(driverId: string): Promise<Violation[]> {
    return this.violationRepo.findByDriver(driverId);
  }

  async getViolationsByStatus(status: string): Promise<Violation[]> {
    return this.violationRepo.findByStatus(status);
  }

  async getViolationsByType(type: string): Promise<Violation[]> {
    return this.violationRepo.findByType(type);
  }

  async getViolationsByPaymentStatus(paymentStatus: string): Promise<Violation[]> {
    return this.violationRepo.findByPaymentStatus(paymentStatus);
  }

  async getViolationsByDateRange(startDate: string, endDate: string): Promise<Violation[]> {
    return this.violationRepo.findByDateRange(startDate, endDate);
  }

  async updateStatus(id: string, status: Violation['status'], updatedBy: string): Promise<Violation> {
    await this.getViolation(id);
    const updated = await this.violationRepo.updateStatus(id, status);
    if (!updated) {
      throw new AppError('Failed to update status', 500);
    }
    logger.info(`Violation status updated: ${updated.violationNumber} -> ${updated.status}`);
    return updated;
  }

  async updatePaymentStatus(id: string, paymentStatus: Violation['paymentStatus'], updatedBy: string): Promise<Violation> {
    await this.getViolation(id);
    const updated = await this.violationRepo.updatePaymentStatus(id, paymentStatus);
    if (!updated) {
      throw new AppError('Failed to update payment status', 500);
    }
    logger.info(`Violation payment status updated: ${updated.violationNumber} -> ${updated.paymentStatus}`);
    return updated;
  }

  async payViolation(id: string, amount: number, paymentDate: string, updatedBy: string): Promise<Violation> {
    const violation = await this.getViolation(id);
    if (violation.status === 'resolved' || violation.status === 'cancelled') {
      throw new AppError('Cannot pay a resolved or cancelled violation', 400);
    }

    if (amount <= 0) {
      throw new AppError('Amount must be greater than 0', 400);
    }

    const updated = await this.violationRepo.payViolation(id, amount, paymentDate);
    if (!updated) {
      throw new AppError('Failed to process payment', 500);
    }

    // If fully paid, resolve the violation
    if (updated.paymentStatus === 'paid') {
      await this.violationRepo.updateStatus(id, 'resolved');
    }

    logger.info(`Violation paid: ${updated.violationNumber} - ${amount}`);
    return updated;
  }

  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    totalFineAmount: number;
    totalPaidAmount: number;
    unpaidAmount: number;
  }> {
    return this.violationRepo.getStats();
  }
}