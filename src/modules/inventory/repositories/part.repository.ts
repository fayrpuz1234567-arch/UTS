// C:\Users\Amir\fleet-erp\backend\src\modules\inventory\repositories\part.repository.ts

import BaseRepository from '../../../core/repositories/base.repository';
import { Part } from '../models/part.model';

export class PartRepository extends BaseRepository<Part> {
  constructor() {
    super('parts');
  }

  async findByCode(code: string): Promise<Part | null> {
    return this.findOne({ code });
  }

  async findByBarcode(barcode: string): Promise<Part | null> {
    return this.findOne({ barcode });
  }

  async findByCategory(categoryId: string): Promise<Part[]> {
    return this.findAll({ filter: { categoryId } });
  }

  async findByWarehouse(warehouseId: string): Promise<Part[]> {
    return this.findAll({ filter: { warehouseId } });
  }

  async findBySupplier(supplierId: string): Promise<Part[]> {
    return this.findAll({ filter: { supplierId } });
  }

  // ✅ جديد: قطع المخزون المنخفض
  async findLowStock(): Promise<Part[]> {
    return this.findAll({
      filter: {
        isActive: true,
        currentStock: { $lte: 'minimumStock' }
      }
    });
  }

  // ✅ جديد: قطع تحتاج إعادة طلب
  async findReorderParts(): Promise<Part[]> {
    return this.findAll({
      filter: {
        isActive: true,
        currentStock: { $lte: 'reorderPoint' }
      }
    });
  }

  // ✅ جديد: قطع منتهية الصلاحية
  async findExpiredParts(): Promise<Part[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.findAll({
      filter: {
        isActive: true,
        expiryDate: { $lte: today }
      }
    });
  }

  async findOutOfStock(): Promise<Part[]> {
    return this.findAll({
      filter: {
        isActive: true,
        currentStock: 0
      }
    });
  }

  async updateStock(partId: string, quantity: number): Promise<Part | null> {
    const part = await this.findById(partId);
    if (!part) return null;
    const newStock = (part.currentStock || 0) + quantity;
    return this.update(partId, { currentStock: newStock });
  }

  // ✅ جديد: تحديث المخزون مع التحقق من الحد الأدنى
  async updateStockWithValidation(partId: string, quantity: number): Promise<{ part: Part; isLowStock: boolean }> {
    const part = await this.findById(partId);
    if (!part) throw new Error('Part not found');
    
    const newStock = (part.currentStock || 0) + quantity;
    const updated = await this.update(partId, { currentStock: newStock });
    if (!updated) throw new Error('Failed to update stock');
    
    const isLowStock = newStock <= (part.minimumStock || 0);
    return { part: updated, isLowStock };
  }

  async getLowStockAlerts(): Promise<Part[]> {
    return this.findAll({
      filter: {
        isActive: true,
        currentStock: { $lte: 'reorderPoint' }
      }
    });
  }
}