import { InsuranceRepository } from '../repositories/insurance.repository';
import { Insurance, CreateInsuranceDTO, UpdateInsuranceDTO } from '../models/insurance.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';

export class InsuranceService {
  constructor(private insuranceRepo: InsuranceRepository) {}

  async createInsurance(data: CreateInsuranceDTO, createdBy: string): Promise<Insurance> {
    const existing = await this.insuranceRepo.findByPolicyNumber(data.policyNumber);
    if (existing) {
      throw new AppError('Insurance policy with this number already exists', 409);
    }

    const insurance = await this.insuranceRepo.create({
      ...data,
      status: 'active',
      claimsCount: 0,
      version: 1,
      isDeleted: false,
      createdBy
    });

    logger.info(`Insurance created: ${insurance.policyNumber} (${insurance.id})`);
    return insurance;
  }

  async getInsurance(id: string): Promise<Insurance> {
    const insurance = await this.insuranceRepo.findById(id);
    if (!insurance) {
      throw new AppError('Insurance not found', 404);
    }
    return insurance;
  }

  async getAllInsurances(filter?: any): Promise<Insurance[]> {
    return this.insuranceRepo.findAll({ filter });
  }

  async updateInsurance(id: string, data: UpdateInsuranceDTO, updatedBy: string): Promise<Insurance> {
    await this.getInsurance(id);
    const updated = await this.insuranceRepo.update(id, { ...data, updatedBy });
    if (!updated) {
      throw new AppError('Failed to update insurance', 500);
    }
    logger.info(`Insurance updated: ${updated.policyNumber}`);
    return updated;
  }

  async deleteInsurance(id: string): Promise<boolean> {
    await this.getInsurance(id);
    return this.insuranceRepo.softDelete(id);
  }

  async getInsurancesByVehicle(vehicleId: string): Promise<Insurance[]> {
    return this.insuranceRepo.findByVehicle(vehicleId);
  }

  async getInsurancesByStatus(status: string): Promise<Insurance[]> {
    return this.insuranceRepo.findByStatus(status);
  }

  async getActiveInsurances(): Promise<Insurance[]> {
    return this.insuranceRepo.findActive();
  }

  async getExpiredInsurances(): Promise<Insurance[]> {
    return this.insuranceRepo.findExpired();
  }

  async getExpiringSoonInsurances(days: number = 30): Promise<Insurance[]> {
    return this.insuranceRepo.findExpiringSoon(days);
  }

  async getActiveByVehicle(vehicleId: string): Promise<Insurance | null> {
    return this.insuranceRepo.getActiveByVehicle(vehicleId);
  }

  async incrementClaims(id: string): Promise<Insurance> {
    const insurance = await this.getInsurance(id);
    const updated = await this.insuranceRepo.incrementClaims(id);
    if (!updated) {
      throw new AppError('Failed to increment claims', 500);
    }
    logger.info(`Claims incremented for insurance: ${updated.policyNumber} (${updated.claimsCount})`);
    return updated;
  }

  async renewInsurance(id: string, newExpiryDate: string, updatedBy: string): Promise<Insurance> {
    const insurance = await this.getInsurance(id);
    if (insurance.status === 'cancelled') {
      throw new AppError('Cannot renew a cancelled insurance policy', 400);
    }

    const updated = await this.insuranceRepo.update(id, {
      expiryDate: newExpiryDate,
      status: 'renewed',
      updatedBy
    });
    if (!updated) {
      throw new AppError('Failed to renew insurance', 500);
    }
    logger.info(`Insurance renewed: ${updated.policyNumber} -> ${updated.expiryDate}`);
    return updated;
  }

  async cancelInsurance(id: string, updatedBy: string): Promise<Insurance> {
    const insurance = await this.getInsurance(id);
    if (insurance.status === 'cancelled') {
      throw new AppError('Insurance already cancelled', 400);
    }

    const updated = await this.insuranceRepo.updateStatus(id, 'cancelled');
    if (!updated) {
      throw new AppError('Failed to cancel insurance', 500);
    }
    logger.info(`Insurance cancelled: ${updated.policyNumber}`);
    return updated;
  }
}