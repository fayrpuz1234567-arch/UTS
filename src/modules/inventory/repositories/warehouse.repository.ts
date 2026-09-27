// C:\Users\Amir\fleet-erp\backend\src\modules\inventory\repositories\warehouse.repository.ts

import BaseRepository from '../../../core/repositories/base.repository';
import { Warehouse } from '../models/warehouse.model';

export class WarehouseRepository extends BaseRepository<Warehouse> {
  constructor() {
    super('warehouses');
  }

  async findByCode(code: string): Promise<Warehouse | null> {
    return this.findOne({ code });
  }

  async findByType(type: string): Promise<Warehouse[]> {
    return this.findAll({ filter: { type } });
  }

  async findActive(): Promise<Warehouse[]> {
    return this.findAll({ filter: { isActive: true } });
  }

  // ✅ جديد: البحث عن مخزن بالمدير
  async findByManager(manager: string): Promise<Warehouse[]> {
    return this.findAll({ filter: { manager } });
  }

  // ✅ جديد: تحديث السعة المستخدمة
  async updateUsedCapacity(warehouseId: string, usedCapacity: number): Promise<Warehouse | null> {
    return this.update(warehouseId, { usedCapacity });
  }

  // ✅ جديد: التحقق من السعة
  async checkCapacity(warehouseId: string, additionalQuantity: number): Promise<boolean> {
    const warehouse = await this.findById(warehouseId);
    if (!warehouse) return false;
    if (!warehouse.capacity) return true; // لا يوجد حد أقصى
    const currentUsed = warehouse.usedCapacity || 0;
    return (currentUsed + additionalQuantity) <= warehouse.capacity;
  }

  // ✅ جديد: إضافة كمية للمخزون المستخدم
  async addToUsedCapacity(warehouseId: string, quantity: number): Promise<Warehouse | null> {
    const warehouse = await this.findById(warehouseId);
    if (!warehouse) return null;
    const currentUsed = warehouse.usedCapacity || 0;
    return this.update(warehouseId, { usedCapacity: currentUsed + quantity });
  }

  // ✅ جديد: طرح كمية من المخزون المستخدم
  async subtractFromUsedCapacity(warehouseId: string, quantity: number): Promise<Warehouse | null> {
    const warehouse = await this.findById(warehouseId);
    if (!warehouse) return null;
    const currentUsed = warehouse.usedCapacity || 0;
    const newUsed = Math.max(0, currentUsed - quantity);
    return this.update(warehouseId, { usedCapacity: newUsed });
  }
}