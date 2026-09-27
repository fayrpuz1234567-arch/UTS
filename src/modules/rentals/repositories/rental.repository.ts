import BaseRepository from '../../../core/repositories/base.repository';
import { Rental } from '../models/rental.model';

export class RentalRepository extends BaseRepository<Rental> {
  constructor() {
    super('rentals');
  }

  async findByRentalNumber(rentalNumber: string): Promise<Rental | null> {
    return this.findOne({ rentalNumber });
  }

  async findByVehicle(vehicleId: string): Promise<Rental[]> {
    return this.findAll({ filter: { vehicleId } });
  }

  async findByDriver(driverId: string): Promise<Rental[]> {
    return this.findAll({ filter: { driverId } });
  }

  async findByEntity(entityId: string): Promise<Rental[]> {
    return this.findAll({ filter: { entityId } });
  }

  async findByStatus(status: string): Promise<Rental[]> {
    return this.findAll({ filter: { status } });
  }

  async findActive(): Promise<Rental[]> {
    return this.findAll({
      filter: { status: 'active' }
    });
  }

  async findActiveByVehicle(vehicleId: string): Promise<Rental[]> {
    return this.findAll({
      filter: { vehicleId, status: 'active' }
    });
  }

  async findActiveByDriver(driverId: string): Promise<Rental[]> {
    return this.findAll({
      filter: { driverId, status: 'active' }
    });
  }

  async updateStatus(id: string, status: Rental['status']): Promise<Rental | null> {
    return this.update(id, { status });
  }

  async completeRental(id: string, endKM: number, totalKM: number): Promise<Rental | null> {
    return this.update(id, {
      status: 'completed',
      endKM,
      totalKM,
      completedAt: new Date().toISOString()
    });
  }

  async cancelRental(id: string, reason: string): Promise<Rental | null> {
    return this.update(id, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: new Date().toISOString()
    });
  }

  async getRentalsByDateRange(startDate: string, endDate: string): Promise<Rental[]> {
    return this.findAll({
      filter: {
        startDate: { $gte: startDate, $lte: endDate }
      }
    });
  }

  // ===== Additional Methods =====

  // Find rentals by payment status
  async findByPaymentStatus(paymentStatus: string): Promise<Rental[]> {
    return this.findAll({ filter: { paymentStatus } });
  }

  // Find overdue rentals (endDate < today and status != completed/cancelled)
  async findOverdue(): Promise<Rental[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.findAll({
      filter: {
        endDate: { $lt: today },
        status: { $nin: ['completed', 'cancelled'] }
      }
    });
  }

  // Find rentals ending within the next X days
  async findExpiringSoon(days: number = 7): Promise<Rental[]> {
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

  // Update payment status
  async updatePaymentStatus(id: string, paymentStatus: Rental['paymentStatus']): Promise<Rental | null> {
    return this.update(id, { paymentStatus });
  }

  // Get total revenue by date range
  async getTotalRevenue(startDate: string, endDate: string): Promise<number> {
    const rentals = await this.findAll({
      filter: {
        startDate: { $gte: startDate, $lte: endDate },
        status: { $in: ['completed', 'active'] }
      }
    });

    return rentals.reduce((sum, rental) => sum + (rental.totalPrice || 0), 0);
  }

  // Get active rentals count for a vehicle
  async getActiveCountByVehicle(vehicleId: string): Promise<number> {
    const rentals = await this.findActiveByVehicle(vehicleId);
    return rentals.length;
  }
}