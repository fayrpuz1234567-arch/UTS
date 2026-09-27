// src/modules/inventory/services/maintenance-parts-sync.util.ts

import type { PartRepository, InventoryTransactionRepository } from '../repositories/inventory.repository';
import type { MaintenanceOrderRepository } from '../../maintenance/repositories/maintenance.repository';
import { logger } from '../../../core/utils/logger';

/**
 * بمجرد ما كمية جديدة من قطعة معينة تدخل المخزون (من أي مصدر: استلام يدوي،
 * استلام أمر شراء، تسوية جرد لصالح الزيادة)، الدالة دي بتدور على كل أوامر
 * الصيانة المفتوحة (مش completed ولا cancelled) اللي لسه محتاجة نفس القطعة
 * في partsNeeded، وتوفرها تلقائيًا حسب الرصيد المتاح، وتحدث الحالة لوحدها.
 *
 * ده بيشتغل من غير ما حد يفتح أي صفحة أو يعمل "حفظ" يدوي - لأنه بيتنفذ
 * جوه الباك إند مباشرة بعد أي حركة استلام حقيقية.
 */
export async function syncMaintenanceNeededParts(
  deps: {
    partRepo: PartRepository;
    transactionRepo: InventoryTransactionRepository;
    maintenanceRepo?: MaintenanceOrderRepository;
  },
  partId: string,
  warehouseId: string,
  createdBy: string = 'system'
): Promise<void> {
  const { partRepo, transactionRepo, maintenanceRepo } = deps;
  if (!maintenanceRepo) return;

  try {
    const candidateOrders = await maintenanceRepo.findAll({
      filter: { status: ['pending_parts', 'parts_ordered', 'parts_received'] }
    });

    if (!candidateOrders || candidateOrders.length === 0) return;

    for (const order of candidateOrders) {
      if (order.status === 'completed' || order.status === 'cancelled') continue;

      const neededList: any[] = order.partsNeeded || [];
      const neededIndex = neededList.findIndex((p) => p.partId === partId);
      if (neededIndex === -1) continue; // الأمر ده مش محتاج القطعة دي أصلاً

      // إعادة قراءة الرصيد في كل تكرار عشان لو أكتر من أمر صيانة بيتنافسوا
      // على نفس القطعة، كل أمر ياخد نصيبه من الرصيد المتبقي فعليًا
      const freshPart = await partRepo.findById(partId);
      const availableStock = freshPart?.currentStock || 0;
      if (availableStock <= 0) continue;

      const needed = neededList[neededIndex];
      const fulfillQty = Math.min(needed.quantity, availableStock);
      if (fulfillQty <= 0) continue;

      const updatedPartsNeeded = [...neededList];
      const updatedPartsUsed = [...(order.partsUsed || [])];
      const remaining = needed.quantity - fulfillQty;
      const unitPrice = needed.estimatedPrice || (freshPart as any)?.unitPrice || 0;

      updatedPartsUsed.push({
        partId,
        partName: needed.partName || (freshPart as any)?.name || 'قطعة',
        partCode: needed.partCode || (freshPart as any)?.code || '',
        quantity: fulfillQty,
        unit: needed.unit || 'قطعة',
        price: unitPrice,
        totalPrice: unitPrice * fulfillQty,
        notes: 'تم توفيرها تلقائيًا من المخزون بعد توفر رصيد جديد'
      });

      if (remaining > 0) {
        updatedPartsNeeded[neededIndex] = { ...needed, quantity: remaining };
      } else {
        updatedPartsNeeded.splice(neededIndex, 1);
      }

      // اسحب الكمية دي فعليًا (net effect = صفر: دخلت المخزن واتصرفت
      // فورًا لنفس أمر الصيانة اللي كانت ناقصاه)
      await transactionRepo.create({
        warehouseId,
        partId,
        transactionType: 'issue',
        quantity: fulfillQty,
        unitPrice,
        referenceType: 'maintenance_order',
        referenceId: order.id,
        notes: `صرف تلقائي لأمر الصيانة ${order.orderNumber} بعد توفر القطعة`,
        status: 'completed',
        createdBy
      } as any);
      await partRepo.updateStock(partId, -fulfillQty);

      const totalPartsCost = updatedPartsUsed.reduce((s, p) => s + (p.totalPrice || 0), 0);
      const laborCost = order.laborCost || 0;
      const newStatus = updatedPartsNeeded.length === 0 ? 'completed' : 'pending_parts';

      await maintenanceRepo.update(order.id, {
        partsNeeded: updatedPartsNeeded,
        partsUsed: updatedPartsUsed,
        partsCost: totalPartsCost,
        totalCost: laborCost + totalPartsCost,
        status: newStatus,
        updatedAt: new Date().toISOString()
      } as any);

      logger.info(
        `✅ Auto-fulfilled ${fulfillQty} of part ${partId} for maintenance order ${order.orderNumber}. New status: ${newStatus}`
      );
    }
  } catch (error) {
    // منسيبش استلام قطعة حقيقي يفشل بسبب خطأ في مزامنة الصيانة
    logger.error('Error syncing maintenance orders after part receiving:', error);
  }
}