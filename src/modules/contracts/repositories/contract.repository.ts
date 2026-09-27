import BaseRepository from '../../../core/repositories/base.repository';
import { Contract } from '../models/contracts.model';

export class ContractRepository extends BaseRepository<Contract> {
  constructor() {
    super('contracts');
  }

  async findByContractNumber(contractNumber: string): Promise<Contract | null> {
    return this.findOne({ contractNumber });
  }

  async findByType(type: string): Promise<Contract[]> {
    return this.findAll({ filter: { type } });
  }

  async findByStatus(status: string): Promise<Contract[]> {
    return this.findAll({ filter: { status } });
  }

  async findByEntity(entityId: string): Promise<Contract[]> {
    return this.findAll({ filter: { entityId } });
  }

  async findBySupplier(supplierId: string): Promise<Contract[]> {
    return this.findAll({ filter: { supplierId } });
  }

  async findActive(): Promise<Contract[]> {
    return this.findAll({ filter: { status: 'active' } });
  }

  async findExpired(): Promise<Contract[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.findAll({
      filter: {
        endDate: { $lt: today },
        status: { $in: ['active', 'draft'] }
      }
    });
  }

  async findExpiringSoon(days: number = 30): Promise<Contract[]> {
    const today = new Date().toISOString().split('T')[0];
    const future = new Date();
    future.setDate(future.getDate() + days);
    const futureStr = future.toISOString().split('T')[0];

    return this.findAll({
      filter: {
        endDate: { $gte: today, $lte: futureStr },
        status: 'active'
      }
    });
  }

  async renewContract(id: string, newEndDate: string): Promise<Contract | null> {
    return this.update(id, {
      endDate: newEndDate,
      status: 'renewed'
    });
  }

  async updateStatus(id: string, status: Contract['status']): Promise<Contract | null> {
    return this.update(id, { status });
  }
}