// C:\Users\Amir\fleet-erp\backend\src\modules\suppliers\services\supplier.service.ts

import { SupplierRepository } from '../repositories/supplier.repository';
import { Supplier, CreateSupplierDTO, UpdateSupplierDTO } from '../models/supplier.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';

export class SupplierService {
  constructor(private supplierRepo: SupplierRepository) {}

  async createSupplier(data: CreateSupplierDTO): Promise<Supplier> {
    const existing = await this.supplierRepo.findByCode(data.code);
    if (existing) {
      throw new AppError('Supplier with this code already exists', 409);
    }

    const supplier = await this.supplierRepo.create({
      ...data,
      isTaxable: data.isTaxable ?? false,
      isApproved: true,
      isActive: true,
      rating: 0,
      version: 1,
      isDeleted: false
    });

    logger.info(`Supplier created: ${supplier.code} (${supplier.id})`);
    return supplier;
  }

  async getSupplier(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepo.findById(id);
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }
    return supplier;
  }

  async getAllSuppliers(filter?: any): Promise<Supplier[]> {
    return this.supplierRepo.findAll({ filter });
  }

  async updateSupplier(id: string, data: UpdateSupplierDTO): Promise<Supplier> {
    await this.getSupplier(id);
    const updated = await this.supplierRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update supplier', 500);
    }
    logger.info(`Supplier updated: ${updated.code}`);
    return updated;
  }

  async deleteSupplier(id: string): Promise<boolean> {
    await this.getSupplier(id);
    return this.supplierRepo.softDelete(id);
  }

  async getActiveSuppliers(): Promise<Supplier[]> {
    return this.supplierRepo.findActive();
  }

  async getTaxableSuppliers(): Promise<Supplier[]> {
    return this.supplierRepo.findTaxable();
  }

  async getSuppliersByType(type: string): Promise<Supplier[]> {
    return this.supplierRepo.findByType(type);
  }

  async checkCommercialRegisterExpiry(supplierId: string): Promise<{ isExpired: boolean; expiryDate?: string }> {
    const supplier = await this.getSupplier(supplierId);
    if (!supplier.commercialRegisterExpiry) {
      return { isExpired: false };
    }
    const today = new Date().toISOString().split('T')[0];
    const isExpired = supplier.commercialRegisterExpiry <= today;
    return { isExpired, expiryDate: supplier.commercialRegisterExpiry };
  }

  async getExpiredCommercialRegisterSuppliers(): Promise<Supplier[]> {
    return this.supplierRepo.findExpiredCommercialRegister();
  }

  async updateSupplierRating(id: string, rating: number): Promise<Supplier> {
    if (rating < 0 || rating > 5) {
      throw new AppError('Rating must be between 0 and 5', 400);
    }
    await this.getSupplier(id);
    const updated = await this.supplierRepo.updateRating(id, rating);
    if (!updated) {
      throw new AppError('Failed to update rating', 500);
    }
    logger.info(`Supplier rating updated: ${updated.code} - ${rating}`);
    return updated;
  }

  async getSupplierStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    taxable: number;
    nonTaxable: number;
    expiredCommercialRegister: number;
    averageRating: number;
  }> {
    const all = await this.supplierRepo.findAll();
    const active = all.filter(s => s.isActive);
    const inactive = all.filter(s => !s.isActive);
    const taxable = all.filter(s => s.isTaxable);
    const nonTaxable = all.filter(s => !s.isTaxable);
    const expiredCommercial = await this.supplierRepo.findExpiredCommercialRegister();
    
    const totalRating = all.reduce((sum, s) => sum + (s.rating || 0), 0);
    const averageRating = all.length > 0 ? totalRating / all.length : 0;

    return {
      total: all.length,
      active: active.length,
      inactive: inactive.length,
      taxable: taxable.length,
      nonTaxable: nonTaxable.length,
      expiredCommercialRegister: expiredCommercial.length,
      averageRating
    };
  }
}