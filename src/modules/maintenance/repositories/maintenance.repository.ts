import BaseRepository from '../../../core/repositories/base.repository';
import { MaintenanceOrder, Workshop, MaintenanceType } from '../models/maintenance.model';
import { ScheduledMaintenance } from '../models/scheduled-maintenance.model';

// ===== Maintenance Order Repository =====
export class MaintenanceOrderRepository extends BaseRepository<MaintenanceOrder> {
  constructor() {
    super('maintenance_orders');
  }

  async findByOrderNumber(orderNumber: string): Promise<MaintenanceOrder | null> {
    return this.findOne({ orderNumber });
  }

  async findByVehicle(vehicleId: string): Promise<MaintenanceOrder[]> {
    return this.findAll({ filter: { vehicleId } });
  }

  async findByWorkshop(workshopId: string): Promise<MaintenanceOrder[]> {
    return this.findAll({ filter: { workshopId } });
  }

  async findByStatus(status: string): Promise<MaintenanceOrder[]> {
    return this.findAll({ filter: { status } });
  }

  async findActiveByVehicle(vehicleId: string): Promise<MaintenanceOrder[]> {
    return this.findAll({
      filter: {
        vehicleId,
        status: { $in: ['scheduled', 'in_progress'] }
      }
    });
  }

  async updateStatus(id: string, status: MaintenanceOrder['status']): Promise<MaintenanceOrder | null> {
    return this.update(id, { status });
  }

  async completeOrder(id: string, endKM: number, totalCost: number): Promise<MaintenanceOrder | null> {
    return this.update(id, {
      status: 'completed',
      endKM,
      totalCost,
      completedAt: new Date().toISOString()
    });
  }

  async approveOrder(id: string, approvedBy: string): Promise<MaintenanceOrder | null> {
    return this.update(id, {
      approvalStatus: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString()
    });
  }

  async rejectOrder(id: string, reason: string): Promise<MaintenanceOrder | null> {
    return this.update(id, {
      approvalStatus: 'rejected',
      rejectionReason: reason,
      rejectedAt: new Date().toISOString()
    });
  }
}

// ===== Workshop Repository =====
export class WorkshopRepository extends BaseRepository<Workshop> {
  constructor() {
    super('workshops');
  }

  async findByCode(code: string): Promise<Workshop | null> {
    return this.findOne({ code });
  }

  async findByType(type: string): Promise<Workshop[]> {
    return this.findAll({ filter: { type } });
  }

  async findActive(): Promise<Workshop[]> {
    return this.findAll({ filter: { isActive: true } });
  }

  async findApproved(): Promise<Workshop[]> {
    return this.findAll({ filter: { isApproved: true, isActive: true } });
  }
}

// ===== Maintenance Type Repository =====
export class MaintenanceTypeRepository extends BaseRepository<MaintenanceType> {
  constructor() {
    super('maintenance_types');
  }

  async findByCode(code: string): Promise<MaintenanceType | null> {
    return this.findOne({ code });
  }

  async findByCategory(category: string): Promise<MaintenanceType[]> {
    return this.findAll({ filter: { category } });
  }

  async findActive(): Promise<MaintenanceType[]> {
    return this.findAll({ filter: { isActive: true } });
  }
}

// ===== Scheduled Maintenance Repository (جديد) =====
export class ScheduledMaintenanceRepository extends BaseRepository<ScheduledMaintenance> {
  constructor() {
    super('scheduled_maintenance');
  }

  async findByVehicle(vehicleId: string): Promise<ScheduledMaintenance[]> {
    return this.findAll({ filter: { vehicleId } });
  }

  async findByStatus(status: string): Promise<ScheduledMaintenance[]> {
    return this.findAll({ filter: { status } });
  }

  async findByDateRange(startDate: string, endDate: string): Promise<ScheduledMaintenance[]> {
    return this.findAll({
      filter: {
        scheduledDate: { $gte: startDate, $lte: endDate }
      }
    });
  }

  async findOverdue(): Promise<ScheduledMaintenance[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.findAll({
      filter: {
        status: 'scheduled',
        scheduledDate: { $lt: today }
      }
    });
  }

  async findUpcoming(days: number = 7): Promise<ScheduledMaintenance[]> {
    const today = new Date().toISOString().split('T')[0];
    const future = new Date();
    future.setDate(future.getDate() + days);
    const futureStr = future.toISOString().split('T')[0];
    
    return this.findAll({
      filter: {
        status: 'scheduled',
        scheduledDate: { $gte: today, $lte: futureStr }
      }
    });
  }

  async findDueByKM(vehicleId: string, currentKM: number): Promise<ScheduledMaintenance[]> {
    return this.findAll({
      filter: {
        vehicleId,
        status: 'scheduled',
        nextDueKM: { $lte: currentKM }
      }
    });
  }

  async updateStatus(id: string, status: ScheduledMaintenance['status']): Promise<ScheduledMaintenance | null> {
    return this.update(id, { status });
  }

  async completeMaintenance(
    id: string,
    actualDate: string,
    lastPerformedKM: number,
    nextDueDate?: string,
    nextDueKM?: number
  ): Promise<ScheduledMaintenance | null> {
    return this.update(id, {
      status: 'completed',
      actualDate,
      lastPerformedDate: actualDate,
      lastPerformedKM,
      nextDueDate,
      nextDueKM
    });
  }

  async getScheduledStats(): Promise<{
    total: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    skipped: number;
    overdue: number;
  }> {
    const all = await this.findAll();
    const scheduled = all.filter(s => s.status === 'scheduled');
    const inProgress = all.filter(s => s.status === 'in_progress');
    const completed = all.filter(s => s.status === 'completed');
    const skipped = all.filter(s => s.status === 'skipped');
    const overdue = all.filter(s => s.status === 'overdue');

    return {
      total: all.length,
      scheduled: scheduled.length,
      inProgress: inProgress.length,
      completed: completed.length,
      skipped: skipped.length,
      overdue: overdue.length
    };
  }
}