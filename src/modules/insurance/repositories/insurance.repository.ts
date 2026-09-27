import BaseRepository from '../../../core/repositories/base.repository';
import { Insurance } from '../models/insurance.model';

export class InsuranceRepository extends BaseRepository<Insurance> {
  constructor() {
    super('insurance');
  }

  async findByPolicyNumber(policyNumber: string): Promise<Insurance | null> {
    return this.findOne({ policyNumber });
  }

  async findByVehicle(vehicleId: string): Promise<Insurance[]> {
    return this.findAll({ filter: { vehicleId } });
  }

  async findByCompany(insuranceCompany: string): Promise<Insurance[]> {
    return this.findAll({ filter: { insuranceCompany } });
  }

  async findByStatus(status: string): Promise<Insurance[]> {
    return this.findAll({ filter: { status } });
  }

  async findActive(): Promise<Insurance[]> {
    return this.findAll({ filter: { status: 'active' } });
  }

  async findExpired(): Promise<Insurance[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.findAll({
      filter: {
        expiryDate: { $lt: today },
        status: { $in: ['active', 'renewed'] }
      }
    });
  }

  async findExpiringSoon(days: number = 30): Promise<Insurance[]> {
    const today = new Date().toISOString().split('T')[0];
    const future = new Date();
    future.setDate(future.getDate() + days);
    const futureStr = future.toISOString().split('T')[0];

    return this.findAll({
      filter: {
        expiryDate: { $gte: today, $lte: futureStr },
        status: 'active'
      }
    });
  }

  async getActiveByVehicle(vehicleId: string): Promise<Insurance | null> {
    const insurances = await this.findAll({
      filter: { vehicleId, status: 'active' },
      limit: 1
    });
    return insurances.length > 0 ? insurances[0] : null;
  }

  async updateStatus(id: string, status: Insurance['status']): Promise<Insurance | null> {
    return this.update(id, { status });
  }

  async incrementClaims(id: string): Promise<Insurance | null> {
    const insurance = await this.findById(id);
    if (!insurance) return null;
    return this.update(id, { claimsCount: (insurance.claimsCount || 0) + 1 });
  }
}