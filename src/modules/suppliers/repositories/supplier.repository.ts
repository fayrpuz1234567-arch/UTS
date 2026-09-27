// C:\Users\Amir\fleet-erp\backend\src\modules\suppliers\repositories\supplier.repository.ts

import BaseRepository from '../../../core/repositories/base.repository';
import { Supplier } from '../models/supplier.model';

export class SupplierRepository extends BaseRepository<Supplier> {
  constructor() {
    super('suppliers');
  }

  async findByCode(code: string): Promise<Supplier | null> {
    return this.findOne({ code });
  }

  async findActive(): Promise<Supplier[]> {
    return this.findAll({ filter: { isActive: true, isApproved: true } });
  }

  async findApproved(): Promise<Supplier[]> {
    return this.findAll({ filter: { isApproved: true } });
  }

  async findByType(type: string): Promise<Supplier[]> {
    return this.findAll({ filter: { supplierType: type } });
  }

  async findTaxable(): Promise<Supplier[]> {
    return this.findAll({ filter: { isTaxable: true, isActive: true } });
  }

  async findExpiredCommercialRegister(): Promise<Supplier[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.findAll({
      filter: {
        isActive: true,
        commercialRegisterExpiry: { $lte: today }
      }
    });
  }

  async updateRating(supplierId: string, rating: number): Promise<Supplier | null> {
    return this.update(supplierId, { rating });
  }
}