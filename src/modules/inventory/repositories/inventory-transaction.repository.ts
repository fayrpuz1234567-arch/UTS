// C:\Users\Amir\fleet-erp\backend\src\modules\inventory\repositories\inventory-transaction.repository.ts

import BaseRepository from '../../../core/repositories/base.repository';
import { InventoryTransaction } from '../models/inventory-transaction.model';
import { PartRepository } from './part.repository';

export class InventoryTransactionRepository extends BaseRepository<InventoryTransaction> {
  constructor() {
    super('inventory_transactions');
  }

  async findByTransactionNumber(transactionNumber: string): Promise<InventoryTransaction | null> {
    return this.findOne({ transactionNumber });
  }

  async findByPart(partId: string): Promise<InventoryTransaction[]> {
    return this.findAll({ filter: { partId } });
  }

  async findByWarehouse(warehouseId: string): Promise<InventoryTransaction[]> {
    return this.findAll({ filter: { warehouseId } });
  }

  async findByReference(referenceType: string, referenceId: string): Promise<InventoryTransaction[]> {
    return this.findAll({
      filter: { referenceType, referenceId }
    });
  }

  async findByType(transactionType: string): Promise<InventoryTransaction[]> {
    return this.findAll({ filter: { transactionType } });
  }

  async getByDateRange(startDate: string, endDate: string): Promise<InventoryTransaction[]> {
    return this.findAll({
      filter: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    });
  }

  async updateStatus(id: string, status: InventoryTransaction['status']): Promise<InventoryTransaction | null> {
    return this.update(id, { status });
  }

  async approveTransaction(id: string, approvedBy: string): Promise<InventoryTransaction | null> {
    return this.update(id, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString()
    });
  }

  async rejectTransaction(id: string, reason: string): Promise<InventoryTransaction | null> {
    return this.update(id, {
      status: 'rejected',
      rejectionReason: reason,
      rejectedAt: new Date().toISOString()
    });
  }

  // ✅ جديد: الحصول على آخر حركة لقطعة معينة
  async getLastTransaction(partId: string): Promise<InventoryTransaction | null> {
    const transactions = await this.findAll({
      filter: { partId },
      sort: { createdAt: 'desc' },
      limit: 1
    });
    return transactions.length > 0 ? transactions[0] : null;
  }

  // ✅ جديد: حساب إجمالي الحركات لقطعة في فترة
  async getPartMovements(partId: string, startDate: string, endDate: string): Promise<{
    received: number;
    issued: number;
    returned: number;
    damaged: number;
    lost: number;
  }> {
    const transactions = await this.findAll({
      filter: {
        partId,
        createdAt: { $gte: startDate, $lte: endDate }
      }
    });

    let received = 0, issued = 0, returned = 0, damaged = 0, lost = 0;

    for (const t of transactions) {
      switch (t.transactionType) {
        case 'receiving':
        case 'transfer_in':
        case 'adjustment_in':
          received += t.quantity;
          break;
        case 'issue':
        case 'transfer_out':
        case 'adjustment_out':
          issued += t.quantity;
          break;
        case 'return':
          returned += t.quantity;
          break;
        case 'damaged':
          damaged += t.quantity;
          break;
        case 'lost':
          lost += t.quantity;
          break;
      }
    }

    return { received, issued, returned, damaged, lost };
  }

  // ✅ جديد: الحصول على حركات المخزون المرتبطة بالصيانة
  async getMaintenanceTransactions(maintenanceOrderId: string): Promise<InventoryTransaction[]> {
    return this.findAll({
      filter: {
        referenceType: 'maintenance_order',
        referenceId: maintenanceOrderId
      },
      sort: { createdAt: 'desc' }
    });
  }

  // ✅ جديد: الحصول على حركات المخزون المرتبطة بالمشتريات
  async getPurchaseTransactions(purchaseOrderId: string): Promise<InventoryTransaction[]> {
    return this.findAll({
      filter: {
        referenceType: 'purchase_order',
        referenceId: purchaseOrderId
      },
      sort: { createdAt: 'desc' }
    });
  }

  // ✅ جديد: الحصول على حركات المخزون المرتبطة بالعهد
  async getTrustTransactions(trustId: string): Promise<InventoryTransaction[]> {
    return this.findAll({
      filter: {
        referenceType: 'trust',
        referenceId: trustId
      },
      sort: { createdAt: 'desc' }
    });
  }

  // ✅ جديد: الحصول على حركات المخزون حسب النوع مع التاريخ
  async getTransactionsByTypeAndDate(
    transactionType: string,
    startDate: string,
    endDate: string
  ): Promise<InventoryTransaction[]> {
    return this.findAll({
      filter: {
        transactionType,
        createdAt: { $gte: startDate, $lte: endDate }
      }
    });
  }

  // ✅ جديد: إحصائيات سريعة للمخزون
  async getInventoryStats(): Promise<{
    totalParts: number;
    totalStockValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalTransactions: number;
  }> {
    const partRepo = new PartRepository();
    const allParts = await partRepo.findAll({ filter: { isDeleted: false } });
    const allTransactions = await this.findAll({ filter: { isDeleted: false } });

    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const part of allParts) {
      const stockValue = (part.currentStock || 0) * (part.averagePrice || part.unitPrice || 0);
      totalStockValue += stockValue;
      
      if ((part.currentStock || 0) <= 0) outOfStockCount++;
      else if ((part.currentStock || 0) <= (part.minimumStock || 0)) lowStockCount++;
    }

    return {
      totalParts: allParts.length,
      totalStockValue,
      lowStockCount,
      outOfStockCount,
      totalTransactions: allTransactions.length
    };
  }
}