// C:\Users\Amir\fleet-erp\backend\src\modules\trusts\services\trust.service.ts

import { TrustRepository } from '../repositories/trust.repository';
import { Trust, CreateTrustDTO, UpdateTrustDTO, ReturnTrustDTO, TrustItem, TransferTrustDTO, TrustTransfer } from '../models/trust.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';
import { InventoryTransactionRepository } from '../../inventory/repositories/inventory.repository';
import { PartRepository } from '../../inventory/repositories/inventory.repository';

export class TrustService {
  constructor(
    private trustRepo: TrustRepository,
    private transactionRepo?: InventoryTransactionRepository,
    private partRepo?: PartRepository
  ) {}

  // ===== Create Trust =====
  async createTrust(data: CreateTrustDTO, createdBy: string): Promise<Trust> {
    const trustNumber = `TR-${Date.now()}`;

    const trust = await this.trustRepo.create({
      trustNumber: trustNumber,
      ...data,
      status: 'active',
      createdBy: createdBy,
      version: 1,
      isDeleted: false,
      items: data.items.map(item => ({
        ...item,
        returnedQuantity: 0,
      })),
    });

    // ✅ إذا كانت القطع مرتبطة بالمخزون، نقوم بإنشاء حركة صرف
    if (this.transactionRepo && this.partRepo) {
      for (const item of data.items) {
        if (item.itemCode) {
          const part = await this.partRepo.findByCode(item.itemCode);
          if (part) {
            await this.transactionRepo.create({
              warehouseId: 'main', // يمكن تحديد المخزن الرئيسي
              partId: part.id,
              transactionType: 'issue',
              quantity: item.quantity,
              referenceType: 'trust',
              referenceId: trust.id,
              notes: `صرف عهد رقم ${trustNumber} - ${item.itemName}`,
              createdBy: createdBy,
            });
          }
        }
      }
    }

    logger.info(`Trust created: ${trust.trustNumber} (${trust.id})`);
    return trust;
  }

  // ===== Get Trust =====
  async getTrust(id: string): Promise<Trust> {
    const trust = await this.trustRepo.findById(id);
    if (!trust) {
      throw new AppError('Trust not found', 404);
    }
    return trust;
  }

  // ===== Get All Trusts =====
  async getAllTrusts(filter?: any): Promise<Trust[]> {
    return this.trustRepo.findAll({ filter });
  }

  // ===== Update Trust =====
  async updateTrust(id: string, data: UpdateTrustDTO): Promise<Trust> {
    await this.getTrust(id);
    const updated = await this.trustRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update trust', 500);
    }
    logger.info(`Trust updated: ${updated.trustNumber}`);
    return updated;
  }

  // ===== Delete Trust =====
  async deleteTrust(id: string): Promise<boolean> {
    await this.getTrust(id);
    return this.trustRepo.softDelete(id);
  }

  // ===== Return Trust (Full) =====
  async returnTrust(id: string, data: ReturnTrustDTO, returnedBy: string): Promise<Trust> {
    const trust = await this.getTrust(id);

    if (trust.status === 'returned') {
      throw new AppError('Trust already returned', 400);
    }
    if (trust.status === 'cancelled') {
      throw new AppError('Cannot return a cancelled trust', 400);
    }

    // تحديث الكميات المرتجعة للعناصر
    const updatedItems = trust.items.map((item: TrustItem) => {
      const returnItem = data.items.find(ri => ri.itemId === item.id);
      if (returnItem) {
        return {
          ...item,
          returnedQuantity: returnItem.returnedQuantity,
          // ✅ FIX: تجنب undefined التي يرفضها Firestore - نوفر قيمة افتراضية نهائية
          returnedCondition: returnItem.returnedCondition || item.condition || 'good',
        };
      }
      return item;
    });

    // التحقق من إرجاع جميع العناصر
    const allReturned = updatedItems.every(
      (item: TrustItem) => (item.returnedQuantity || 0) >= item.quantity
    );
    const partialReturn = updatedItems.some(
      (item: TrustItem) => (item.returnedQuantity || 0) > 0 && (item.returnedQuantity || 0) < item.quantity
    );

    let status: Trust['status'] = 'returned';
    if (partialReturn) {
      status = 'partial';
    }

    const updated = await this.trustRepo.update(id, {
      items: updatedItems,
      status: status,
      returnDate: data.returnDate,
      returnedBy: returnedBy,
      notes: data.notes || trust.notes,
    });

    if (!updated) {
      throw new AppError('Failed to return trust', 500);
    }

    // ✅ إرجاع القطع للمخزون
    if (this.transactionRepo && this.partRepo) {
      for (const item of updatedItems) {
        if (item.itemCode && (item.returnedQuantity || 0) > 0) {
          const part = await this.partRepo.findByCode(item.itemCode);
          if (part) {
            await this.transactionRepo.create({
              warehouseId: 'main',
              partId: part.id,
              transactionType: 'return',
              quantity: item.returnedQuantity || 0,
              referenceType: 'trust',
              referenceId: trust.id,
              notes: `إرجاع عهد رقم ${trust.trustNumber} - ${item.itemName}`,
              createdBy: returnedBy,
            });
          }
        }
      }
    }

    logger.info(`Trust returned: ${updated.trustNumber}`);
    return updated;
  }

  // ===== Transfer Trust (نقل العهدة من صاحبها الحالي لموظف آخر) =====
  async transferTrust(id: string, data: TransferTrustDTO, transferredBy: string): Promise<Trust> {
    const trust = await this.getTrust(id);

    if (trust.status === 'returned') {
      throw new AppError('لا يمكن نقل عهدة تم إرجاعها بالفعل', 400);
    }
    if (trust.status === 'cancelled') {
      throw new AppError('لا يمكن نقل عهدة ملغاة', 400);
    }
    if (!data.toTrusteeId) {
      throw new AppError('صاحب العهدة الجديد مطلوب', 400);
    }
    if (!data.transferDate) {
      throw new AppError('تاريخ نقل العهدة مطلوب', 400);
    }
    if (data.toTrusteeId === trust.trusteeId) {
      throw new AppError('لا يمكن نقل العهدة لنفس صاحب العهدة الحالي', 400);
    }

    const transferRecord: TrustTransfer = {
      fromTrusteeId: trust.trusteeId,
      fromTrusteeName: trust.trusteeName,
      toTrusteeId: data.toTrusteeId,
      toTrusteeName: data.toTrusteeName,
      toTrusteeType: data.toTrusteeType || trust.trusteeType,
      transferDate: data.transferDate,
      notes: data.notes,
      transferredBy: transferredBy,
      createdAt: new Date().toISOString(),
    };

    const updatedHistory = [...(trust.transferHistory || []), transferRecord];

    const updated = await this.trustRepo.update(id, {
      trusteeId: data.toTrusteeId,
      trusteeType: data.toTrusteeType || trust.trusteeType,
      trusteeName: data.toTrusteeName,
      transferHistory: updatedHistory,
    } as any);

    if (!updated) {
      throw new AppError('فشل نقل العهدة', 500);
    }

    logger.info(`Trust transferred: ${updated.trustNumber} from ${trust.trusteeId} to ${data.toTrusteeId}`);
    return updated;
  }

  // ===== Cancel Trust =====
  async cancelTrust(id: string, reason: string, cancelledBy: string): Promise<Trust> {
    const trust = await this.getTrust(id);
    
    if (trust.status === 'returned') {
      throw new AppError('Cannot cancel a returned trust', 400);
    }

    const updated = await this.trustRepo.update(id, {
      status: 'cancelled',
      notes: `${trust.notes || ''} - Cancelled: ${reason}`,
      updatedBy: cancelledBy,
    });

    if (!updated) {
      throw new AppError('Failed to cancel trust', 500);
    }

    logger.info(`Trust cancelled: ${updated.trustNumber}`);
    return updated;
  }

  // ===== Get Trusts by Trustee =====
  async getTrustsByTrustee(trusteeId: string): Promise<Trust[]> {
    return this.trustRepo.findByTrustee(trusteeId);
  }

  // ===== Get Trusts by Status =====
  async getTrustsByStatus(status: string): Promise<Trust[]> {
    return this.trustRepo.findByStatus(status);
  }

  // ===== Get Active Trusts =====
  async getActiveTrusts(): Promise<Trust[]> {
    return this.trustRepo.findActive();
  }

  // ===== Get Overdue Trusts =====
  async getOverdueTrusts(): Promise<Trust[]> {
    return this.trustRepo.findOverdue();
  }

  // ===== Get Trust Stats =====
  async getTrustStats(): Promise<{
    total: number;
    active: number;
    returned: number;
    partial: number;
    overdue: number;
    cancelled: number;
  }> {
    return this.trustRepo.getTrustStats();
  }
}

//hi