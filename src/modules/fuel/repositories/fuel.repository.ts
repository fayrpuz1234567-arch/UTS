import BaseRepository from '../../../core/repositories/base.repository';
import { FuelLog, FuelCard, FuelStation } from '../models/fuel.model';

// ===== Fuel Log Repository =====
export class FuelLogRepository extends BaseRepository<FuelLog> {
  constructor() {
    super('fuel_logs');
  }

  async findByVehicle(vehicleId: string): Promise<FuelLog[]> {
    return this.findAll({ filter: { vehicleId } });
  }

  async findByDriver(driverId: string): Promise<FuelLog[]> {
    return this.findAll({ filter: { driverId } });
  }



  async findByDateRange(startDate: string, endDate: string): Promise<FuelLog[]> {
    return this.findAll({
      filter: {
        date: { $gte: startDate, $lte: endDate }
      }
    });
  }

  async findSuspicious(): Promise<FuelLog[]> {
    return this.findAll({ filter: { isSuspicious: true } });
  }

  async getLastFuelLog(vehicleId: string): Promise<FuelLog | null> {
    const logs = await this.findAll({
      filter: { vehicleId },
      sort: { date: 'desc' }, // ✅ استخدام 'desc' بدلاً من -1
      limit: 1
    });
    return logs.length > 0 ? logs[0] : null;
  }

  async verifyFuelLog(id: string, verifiedBy: string): Promise<FuelLog | null> {
    return this.update(id, {
      verificationStatus: 'verified',
      verifiedBy,
      verifiedAt: new Date().toISOString()
    });
  }

  async rejectFuelLog(id: string, reason: string): Promise<FuelLog | null> {
    return this.update(id, {
      verificationStatus: 'rejected',
      rejectionReason: reason
    });
  }

  // ✅ دالة البحث العامة مع دعم الفلاتر
  async findAllWithFilters(filters?: {
    vehicleId?: string;
    driverId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: FuelLog[]; total: number }> {
    const filter: any = {};

    if (filters?.vehicleId) {
      filter.vehicleId = filters.vehicleId;
    }
    if (filters?.driverId) {
      filter.driverId = filters.driverId;
    }

    // فلترة التاريخ
    if (filters?.dateFrom || filters?.dateTo) {
      filter.date = {};
      if (filters.dateFrom) filter.date.$gte = filters.dateFrom;
      if (filters.dateTo) filter.date.$lte = filters.dateTo;
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;

    // ✅ إذا كان هناك بحث، نبحث في عدة حقول
    let searchFilter = {};
    if (filters?.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      searchFilter = {
        $or: [
          { vehicleId: searchRegex },
          { driverId: searchRegex },
          { cardNumber: searchRegex },
          { fuelType: searchRegex },
        ]
      };
    }

    const finalFilter = { ...filter, ...searchFilter };

    const data = await this.findAll({
      filter: finalFilter,
      sort: { date: 'desc', createdAt: 'desc' }, // ✅ استخدام 'desc' بدلاً من -1
      page,
      limit
    });

    const total = await this.count(finalFilter);

    return { data, total };
  }
}

// ===== Fuel Card Repository =====
export class FuelCardRepository extends BaseRepository<FuelCard> {
  constructor() {
    super('fuel_cards');
  }

  async findByCardNumber(cardNumber: string): Promise<FuelCard | null> {
    return this.findOne({ cardNumber });
  }

  async findByVehicle(vehicleId: string): Promise<FuelCard | null> {
    return this.findOne({ assignedVehicleId: vehicleId });
  }

  async findActive(): Promise<FuelCard[]> {
    return this.findAll({ filter: { isActive: true } });
  }

  async updateBalance(cardId: string, amount: number): Promise<FuelCard | null> {
    const card = await this.findById(cardId);
    if (!card) return null;
    return this.update(cardId, { balance: (card.balance || 0) + amount });
  }

  async assignToVehicle(cardId: string, vehicleId: string): Promise<FuelCard | null> {
    return this.update(cardId, { assignedVehicleId: vehicleId });
  }

  async unassignFromVehicle(cardId: string): Promise<FuelCard | null> {
    return this.update(cardId, { assignedVehicleId: undefined });
  }
}

// ===== Fuel Station Repository =====
export class FuelStationRepository extends BaseRepository<FuelStation> {
  constructor() {
    super('fuel_stations');
  }

  async findByCode(code: string): Promise<FuelStation | null> {
    return this.findOne({ code });
  }

  async findByCompany(company: string): Promise<FuelStation[]> {
    return this.findAll({ filter: { company } });
  }

  async findActive(): Promise<FuelStation[]> {
    return this.findAll({ filter: { isActive: true } });
  }
}