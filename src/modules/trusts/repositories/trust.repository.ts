// C:\Users\Amir\fleet-erp\backend\src\modules\trusts\repositories\trust.repository.ts

import BaseRepository from '../../../core/repositories/base.repository';
import { Trust } from '../models/trust.model';

export class TrustRepository extends BaseRepository<Trust> {
  constructor() {
    super('trusts');
  }

  async findByTrustNumber(trustNumber: string): Promise<Trust | null> {
    return this.findOne({ trustNumber });
  }

  async findByTrustee(trusteeId: string): Promise<Trust[]> {
    return this.findAll({ filter: { trusteeId } });
  }

  async findByTrusteeType(trusteeType: string): Promise<Trust[]> {
    return this.findAll({ filter: { trusteeType } });
  }

  async findByStatus(status: string): Promise<Trust[]> {
    return this.findAll({ filter: { status } });
  }

  async findActive(): Promise<Trust[]> {
    return this.findAll({ filter: { status: 'active' } });
  }

  async findOverdue(): Promise<Trust[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.findAll({
      filter: {
        status: 'active',
        expectedReturnDate: { $lte: today }
      }
    });
  }

  async findByDateRange(startDate: string, endDate: string): Promise<Trust[]> {
    return this.findAll({
      filter: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    });
  }

  async updateStatus(id: string, status: Trust['status']): Promise<Trust | null> {
    return this.update(id, { status });
  }

  async returnTrust(id: string, returnDate: string, returnedBy: string): Promise<Trust | null> {
    return this.update(id, {
      status: 'returned',
      returnDate: returnDate,
      returnedBy: returnedBy,
    });
  }

  async partialReturn(id: string, returnDate: string, returnedBy: string): Promise<Trust | null> {
    return this.update(id, {
      status: 'partial',
      returnDate: returnDate,
      returnedBy: returnedBy,
    });
  }

  async getTrustStats(): Promise<{
    total: number;
    active: number;
    returned: number;
    partial: number;
    overdue: number;
    cancelled: number;
  }> {
    const all = await this.findAll();
    const active = all.filter(t => t.status === 'active');
    const returned = all.filter(t => t.status === 'returned');
    const partial = all.filter(t => t.status === 'partial');
    const overdue = all.filter(t => t.status === 'overdue');
    const cancelled = all.filter(t => t.status === 'cancelled');

    return {
      total: all.length,
      active: active.length,
      returned: returned.length,
      partial: partial.length,
      overdue: overdue.length,
      cancelled: cancelled.length
    };
  }
}