import BaseRepository from '../../../core/repositories/base.repository';
import { Violation } from '../models/violations.model';

export class ViolationRepository extends BaseRepository<Violation> {
  constructor() {
    super('violations');
  }

  async findByViolationNumber(violationNumber: string): Promise<Violation | null> {
    return this.findOne({ violationNumber });
  }

  async findByVehicle(vehicleId: string): Promise<Violation[]> {
    return this.findAll({ filter: { vehicleId } });
  }

  async findByDriver(driverId: string): Promise<Violation[]> {
    return this.findAll({ filter: { driverId } });
  }

  async findByStatus(status: string): Promise<Violation[]> {
    return this.findAll({ filter: { status } });
  }

  async findByType(type: string): Promise<Violation[]> {
    return this.findAll({ filter: { type } });
  }

  async findByPaymentStatus(paymentStatus: string): Promise<Violation[]> {
    return this.findAll({ filter: { paymentStatus } });
  }

  async findByDateRange(startDate: string, endDate: string): Promise<Violation[]> {
    return this.findAll({
      filter: {
        violationDate: { $gte: startDate, $lte: endDate }
      }
    });
  }

  async updateStatus(id: string, status: Violation['status']): Promise<Violation | null> {
    return this.update(id, { status });
  }

  async updatePaymentStatus(id: string, paymentStatus: Violation['paymentStatus']): Promise<Violation | null> {
    return this.update(id, { paymentStatus });
  }

  async payViolation(id: string, amount: number, paymentDate: string): Promise<Violation | null> {
    const violation = await this.findById(id);
    if (!violation) return null;

    const newPaidAmount = (violation.paidAmount || 0) + amount;
    let paymentStatus: Violation['paymentStatus'] = 'paid';
    if (newPaidAmount < violation.fineAmount) {
      paymentStatus = 'partial';
    }

    return this.update(id, {
      paidAmount: newPaidAmount,
      paymentStatus,
      paymentDate
    });
  }

  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    totalFineAmount: number;
    totalPaidAmount: number;
    unpaidAmount: number;
  }> {
    const all = await this.findAll();
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalFineAmount = 0;
    let totalPaidAmount = 0;

    for (const violation of all) {
      byType[violation.type] = (byType[violation.type] || 0) + 1;
      byStatus[violation.status] = (byStatus[violation.status] || 0) + 1;
      totalFineAmount += violation.fineAmount || 0;
      totalPaidAmount += violation.paidAmount || 0;
    }

    return {
      total: all.length,
      byType,
      byStatus,
      totalFineAmount,
      totalPaidAmount,
      unpaidAmount: totalFineAmount - totalPaidAmount
    };
  }
}