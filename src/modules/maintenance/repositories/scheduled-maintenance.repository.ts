// C:\Users\Amir\fleet-erp\backend\src\modules\maintenance\repositories\scheduled-maintenance.repository.ts

import BaseRepository from '../../../core/repositories/base.repository';
import { ScheduledMaintenance } from '../models/scheduled-maintenance.model';

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