// C:\Users\Amir\fleet-erp\backend\src\modules\inventory\services\inventory.service.ts

import {
  PartRepository,
  WarehouseRepository,
  InventoryTransactionRepository
} from '../repositories/inventory.repository';
import {
  Part,
  CreatePartDTO,
  UpdatePartDTO,
  Warehouse,
  CreateWarehouseDTO,
  InventoryTransaction,
  CreateTransactionDTO
} from '../models/inventory.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';
import type { MaintenanceOrderRepository } from '../../maintenance/repositories/maintenance.repository';
import { syncMaintenanceNeededParts } from './maintenance-parts-sync.util';

export class InventoryService {
  constructor(
    private partRepo: PartRepository,
    private warehouseRepo: WarehouseRepository,
    private transactionRepo: InventoryTransactionRepository,
    // ✅ جديد: اختياري عشان ميكسرش أي مكان تاني بيعمل new InventoryService(...)
    // من غير ما يمرره. لو اتمرر، أي حركة استلام تزود المخزون هتفحص أوامر
    // الصيانة المفتوحة تلقائيًا وتوفر لها القطع الناقصة وتحدث حالتها.
    private maintenanceRepo?: MaintenanceOrderRepository
  ) {}

  // ===== Part Methods =====
  async createPart(data: CreatePartDTO): Promise<Part> {
    const existing = await this.partRepo.findByCode(data.code);
    if (existing) {
      throw new AppError('Part with this code already exists', 409);
    }

    if (data.barcode) {
      const existingBarcode = await this.partRepo.findByBarcode(data.barcode);
      if (existingBarcode) {
        throw new AppError('Part with this barcode already exists', 409);
      }
    }

    const part = await this.partRepo.create({
      ...data,
      currentStock: 0,
      averagePrice: data.unitPrice,
      lastPurchasePrice: data.unitPrice,
      isConsumable: true,
      isActive: true,
      version: 1,
      isDeleted: false
    });

    logger.info(`Part created: ${part.code} (${part.id})`);
    return part;
  }

  async getPart(id: string): Promise<Part> {
    const part = await this.partRepo.findById(id);
    if (!part) {
      throw new AppError('Part not found', 404);
    }
    return part;
  }

  async getAllParts(filter?: any): Promise<Part[]> {
    return this.partRepo.findAll({ filter });
  }

  async updatePart(id: string, data: UpdatePartDTO): Promise<Part> {
    await this.getPart(id);
    const updated = await this.partRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update part', 500);
    }
    logger.info(`Part updated: ${updated.code}`);
    return updated;
  }

  async deletePart(id: string): Promise<boolean> {
    await this.getPart(id);
    return this.partRepo.softDelete(id);
  }

  // ✅ جديد: الحصول على قطع المخزون المنخفض
  async getLowStockParts(): Promise<Part[]> {
    return this.partRepo.findLowStock();
  }

  // ✅ جديد: الحصول على قطع تحتاج إعادة طلب
  async getReorderParts(): Promise<Part[]> {
    return this.partRepo.findReorderParts();
  }

  // ✅ جديد: الحصول على قطع منتهية الصلاحية
  async getExpiredParts(): Promise<Part[]> {
    return this.partRepo.findExpiredParts();
  }

  async getLowStockAlerts(): Promise<Part[]> {
    return this.partRepo.getLowStockAlerts();
  }

  // ===== Warehouse Methods =====
  async createWarehouse(data: CreateWarehouseDTO): Promise<Warehouse> {
    const existing = await this.warehouseRepo.findByCode(data.code);
    if (existing) {
      throw new AppError('Warehouse with this code already exists', 409);
    }

    const warehouse = await this.warehouseRepo.create({
      ...data,
      isActive: true,
      usedCapacity: 0,
      version: 1,
      isDeleted: false
    });

    logger.info(`Warehouse created: ${warehouse.code}`);
    return warehouse;
  }

  async getWarehouse(id: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepo.findById(id);
    if (!warehouse) {
      throw new AppError('Warehouse not found', 404);
    }
    return warehouse;
  }

  async getAllWarehouses(): Promise<Warehouse[]> {
    return this.warehouseRepo.findAll();
  }

  async updateWarehouse(id: string, data: Partial<Warehouse>): Promise<Warehouse> {
    await this.getWarehouse(id);
    const updated = await this.warehouseRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update warehouse', 500);
    }
    return updated;
  }

  async deleteWarehouse(id: string): Promise<boolean> {
    await this.getWarehouse(id);
    return this.warehouseRepo.softDelete(id);
  }

  // ===== Transaction Methods =====
  async createTransaction(data: CreateTransactionDTO): Promise<InventoryTransaction> {
    // التحقق من وجود القطعة
    const part = await this.partRepo.findById(data.partId);
    if (!part) {
      throw new AppError('Part not found', 404);
    }

    // التحقق من وجود المخزن
    const warehouse = await this.warehouseRepo.findById(data.warehouseId);
    if (!warehouse) {
      throw new AppError('Warehouse not found', 404);
    }

    // حساب الرصيد قبل الحركة
    const balanceBefore = part.currentStock || 0;
    let balanceAfter = balanceBefore;

    // حساب تأثير الحركة على المخزون
    switch (data.transactionType) {
      case 'receiving':
      case 'transfer_in':
      case 'adjustment_in':
      case 'return':
        balanceAfter = balanceBefore + data.quantity;
        break;
      case 'issue':
      case 'transfer_out':
      case 'adjustment_out':
      case 'damaged':
      case 'lost':
        balanceAfter = balanceBefore - data.quantity;
        break;
      default:
        throw new AppError('Invalid transaction type', 400);
    }

    // التحقق من عدم وجود رصيد سالب
    if (balanceAfter < 0) {
      throw new AppError('Insufficient stock', 400);
    }

    const totalPrice = data.unitPrice ? data.unitPrice * data.quantity : 0;

    // إنشاء الحركة
    const transaction = await this.transactionRepo.create({
      ...data,
      transactionNumber: `TR-${Date.now()}`,
      balanceBefore,
      balanceAfter,
      totalPrice,
      // ✅ FIX: كانت 'pending' بينما الرصيد بيتحدث فورًا تحت - ده كان بيدي انطباع غلط
      // إن الحركة محتاجة موافقة وهي فعليًا بتأثر على المخزون على طول.
      // كل الحركات التلقائية (من الصيانة/المشتريات) لازم تبقى completed مباشرة
      // عشان الأتمتة متعتمدش على حد يوافق يدوي.
      status: 'completed',
      version: 1
    });

    // ✅ FIX الحرج: كان بيبعت quantity موجبة دايمًا بغض النظر عن نوع الحركة،
    // فكانت حركة "issue" (سحب قطعة للصيانة) بتزوّد المخزون بدل ما تنقصه!
    // دلوقتي بنستخدم نفس الفرق (delta) اللي اتحسب فوق حسب نوع الحركة.
    const stockDelta = balanceAfter - balanceBefore;
    await this.partRepo.updateStock(data.partId, stockDelta);

    logger.info(`Transaction created: ${transaction.transactionNumber} (${data.transactionType}, delta: ${stockDelta})`);

    // ✅ جديد: أي زيادة فعلية في الرصيد (استلام يدوي، إرجاع، تسوية بالزيادة...)
    // ممكن توفّر قطعة كانت ناقصة في أمر صيانة مفتوح. نفحص ده هنا مباشرة
    // عشان الحالة تتحدث لوحدها من غير ما حد يفتح أي صفحة.
    if (stockDelta > 0) {
      await syncMaintenanceNeededParts(
        { partRepo: this.partRepo, transactionRepo: this.transactionRepo, maintenanceRepo: this.maintenanceRepo },
        data.partId,
        data.warehouseId,
        (transaction as any).createdBy || (data as any).createdBy || 'system'
      );
    }

    return transaction;
  }

  async getTransaction(id: string): Promise<InventoryTransaction> {
    const transaction = await this.transactionRepo.findById(id);
    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }
    return transaction;
  }

  async getAllTransactions(filter?: any): Promise<InventoryTransaction[]> {
    return this.transactionRepo.findAll({ filter });
  }

  async getTransactionsByPart(partId: string): Promise<InventoryTransaction[]> {
    return this.transactionRepo.findByPart(partId);
  }

  async getTransactionsByWarehouse(warehouseId: string): Promise<InventoryTransaction[]> {
    return this.transactionRepo.findByWarehouse(warehouseId);
  }

  async approveTransaction(id: string, approvedBy: string): Promise<InventoryTransaction> {
    const transaction = await this.getTransaction(id);
    if (transaction.status !== 'pending') {
      throw new AppError('Transaction already processed', 400);
    }

    const updated = await this.transactionRepo.approveTransaction(id, approvedBy);
    if (!updated) {
      throw new AppError('Failed to approve transaction', 500);
    }

    logger.info(`Transaction approved: ${updated.transactionNumber}`);
    return updated;
  }

  async rejectTransaction(id: string, reason: string): Promise<InventoryTransaction> {
    const transaction = await this.getTransaction(id);
    if (transaction.status !== 'pending') {
      throw new AppError('Transaction already processed', 400);
    }

    // ✅ FIX: كان بيرجع المخزون بافتراض إن الحركة الأصلية كانت دايمًا +quantity،
    // وده غلط لو كانت الحركة من نوع "issue" أو أي نوع تاني بيقلل المخزون.
    // الصح إننا نعكس نفس الفرق (delta) اللي اتسجل فعليًا وقت إنشاء الحركة.
    const part = await this.partRepo.findById(transaction.partId);
    if (part) {
      const originalDelta = (transaction.balanceAfter ?? 0) - (transaction.balanceBefore ?? 0);
      await this.partRepo.updateStock(transaction.partId, -originalDelta);
    }

    const updated = await this.transactionRepo.rejectTransaction(id, reason);
    if (!updated) {
      throw new AppError('Failed to reject transaction', 500);
    }

    logger.info(`Transaction rejected: ${updated.transactionNumber}`);
    return updated;
  }

  // ✅ جديد: الحصول على حركات المخزون المرتبطة بالصيانة
  async getMaintenanceTransactions(maintenanceOrderId: string): Promise<InventoryTransaction[]> {
    return this.transactionRepo.getMaintenanceTransactions(maintenanceOrderId);
  }

  // ✅ جديد: الحصول على حركات المخزون حسب المرجع
  async getTransactionsByReference(referenceType: string, referenceId: string): Promise<InventoryTransaction[]> {
    return this.transactionRepo.findByReference(referenceType, referenceId);
  }

  // ✅ جديد: حساب حركات القطعة في فترة
  async getPartMovements(partId: string, startDate: string, endDate: string) {
    return this.transactionRepo.getPartMovements(partId, startDate, endDate);
  }

  // ✅ جديد: تحديث المخزون مع التحقق من الحد الأدنى
  async updateStockWithValidation(partId: string, quantity: number): Promise<{
    part: Part;
    isLowStock: boolean;
    isReorderNeeded: boolean;
  }> {
    const result = await this.partRepo.updateStockWithValidation(partId, quantity);
    const isReorderNeeded = result.part.currentStock <= (result.part.reorderPoint || 0);
    return {
      part: result.part,
      isLowStock: result.isLowStock,
      isReorderNeeded
    };
  }

  // ===== Maintenance Inventory Methods =====

  // سحب قطع غيار للصيانة
  async withdrawPartsForMaintenance(
    partId: string,
    quantity: number,
    maintenanceOrderId: string,
    warehouseId: string,
    createdBy: string
  ): Promise<InventoryTransaction> {
    const part = await this.partRepo.findById(partId);
    if (!part) {
      throw new AppError('Part not found', 404);
    }

    if (part.currentStock < quantity) {
      throw new AppError(`Insufficient stock. Available: ${part.currentStock}`, 400);
    }

    const transaction = await this.transactionRepo.create({
      warehouseId,
      partId,
      transactionType: 'issue',
      quantity,
      referenceType: 'maintenance_order',
      referenceId: maintenanceOrderId,
      notes: `سحب للصيانة رقم ${maintenanceOrderId}`,
      status: 'completed',
      createdBy
    });

    await this.partRepo.updateStock(partId, -quantity);

    logger.info(`Parts withdrawn for maintenance: ${maintenanceOrderId}`);
    return transaction;
  }

  // إرجاع قطع غيار من الصيانة
  async returnPartsFromMaintenance(
    partId: string,
    quantity: number,
    maintenanceOrderId: string,
    warehouseId: string,
    createdBy: string
  ): Promise<InventoryTransaction> {
    const part = await this.partRepo.findById(partId);
    if (!part) {
      throw new AppError('Part not found', 404);
    }

    const transaction = await this.transactionRepo.create({
      warehouseId,
      partId,
      transactionType: 'return',
      quantity,
      referenceType: 'maintenance_order',
      referenceId: maintenanceOrderId,
      notes: `إرجاع من الصيانة رقم ${maintenanceOrderId}`,
      status: 'completed',
      createdBy
    });

    await this.partRepo.updateStock(partId, quantity);

    // ✅ جديد: إرجاع القطعة زيادة في الرصيد، ممكن توفر لأمر صيانة تاني محتاجها
    await syncMaintenanceNeededParts(
      { partRepo: this.partRepo, transactionRepo: this.transactionRepo, maintenanceRepo: this.maintenanceRepo },
      partId,
      warehouseId,
      createdBy
    );

    logger.info(`Parts returned from maintenance: ${maintenanceOrderId}`);
    return transaction;
  }

  // الحصول على قطع الغيار المستخدمة في الصيانة
  async getPartsUsedInMaintenance(maintenanceOrderId: string): Promise<InventoryTransaction[]> {
    return this.transactionRepo.findAll({
      filter: {
        referenceType: 'maintenance_order',
        referenceId: maintenanceOrderId,
        transactionType: 'issue'
      }
    });
  }

  // إحصاءات قطع الغيار المستهلكة
  async getPartsConsumptionStats(startDate: string, endDate: string): Promise<any> {
    const transactions = await this.transactionRepo.findAll({
      filter: {
        transactionType: 'issue',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    });

    const stats: Record<string, any> = {};

    for (const transaction of transactions) {
      const partId = transaction.partId;
      if (!stats[partId]) {
        const part = await this.partRepo.findById(partId);
        stats[partId] = {
          partId,
          partName: part?.name || 'غير معروف',
          partCode: part?.code || '',
          totalQuantity: 0,
          totalCost: 0,
          transactions: []
        };
      }
      stats[partId].totalQuantity += transaction.quantity;
      stats[partId].totalCost += (transaction.quantity || 0) * (transaction.unitPrice || 0);
      stats[partId].transactions.push(transaction);
    }

    return Object.values(stats);
  }

  // تحديث المخزون بعد استلام قطع غيار
  async updateStockAfterReceiving(
    partId: string,
    quantity: number,
    unitPrice: number,
    warehouseId: string,
    notes?: string
  ): Promise<InventoryTransaction> {
    const part = await this.partRepo.findById(partId);
    if (!part) {
      throw new AppError('Part not found', 404);
    }

    const transaction = await this.transactionRepo.create({
      warehouseId,
      partId,
      transactionType: 'receiving',
      quantity,
      unitPrice,
      notes: notes || 'استلام قطع غيار',
      status: 'completed',
      createdBy: 'system'
    });

    await this.partRepo.updateStock(partId, quantity);

    // تحديث متوسط السعر
    const currentStock = part.currentStock + quantity;
    const newAveragePrice = ((part.currentStock * (part.averagePrice || 0)) + (quantity * unitPrice)) / currentStock;
    await this.partRepo.update(partId, {
      averagePrice: newAveragePrice,
      lastPurchasePrice: unitPrice
    });

    // ✅ جديد: بمجرد ما الكمية دي تدخل المخزون، افحص فورًا هل فيه أوامر
    // صيانة مفتوحة كانت ناقصاها القطعة دي - ووفرها تلقائيًا لو أيوه
    await syncMaintenanceNeededParts(
      { partRepo: this.partRepo, transactionRepo: this.transactionRepo, maintenanceRepo: this.maintenanceRepo },
      partId,
      warehouseId,
      'system'
    );

    logger.info(`Stock updated after receiving: ${partId} +${quantity}`);
    return transaction;
  }

  // ✅ جديد: إحصائيات المخزون
  async getInventoryStats(): Promise<{
    totalParts: number;
    totalStockValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalTransactions: number;
  }> {
    return this.transactionRepo.getInventoryStats();
  }

  // ✅ جديد: الحصول على حركات المخزون حسب النوع والتاريخ
  async getTransactionsByTypeAndDate(
    transactionType: string,
    startDate: string,
    endDate: string
  ): Promise<InventoryTransaction[]> {
    return this.transactionRepo.getTransactionsByTypeAndDate(transactionType, startDate, endDate);
  }

  // ✅ جديد: الحصول على حركات المخزون المرتبطة بالمشتريات
  async getPurchaseTransactions(purchaseOrderId: string): Promise<InventoryTransaction[]> {
    return this.transactionRepo.getPurchaseTransactions(purchaseOrderId);
  }

  // ✅ جديد: الحصول على حركات المخزون المرتبطة بالعهد
  async getTrustTransactions(trustId: string): Promise<InventoryTransaction[]> {
    return this.transactionRepo.getTrustTransactions(trustId);
  }

  // ✅ جديد: جرد المخزون (تحديث الكميات بناءً على الجرد الفعلي)
  async countInventory(
    partId: string,
    actualQuantity: number,
    warehouseId: string,
    createdBy: string,
    notes?: string
  ): Promise<InventoryTransaction> {
    const part = await this.partRepo.findById(partId);
    if (!part) {
      throw new AppError('Part not found', 404);
    }

    const currentStock = part.currentStock || 0;
    const difference = actualQuantity - currentStock;

    if (difference === 0) {
      throw new AppError('No difference between current and actual stock', 400);
    }

    const transactionType = difference > 0 ? 'adjustment_in' : 'adjustment_out';

    const transaction = await this.transactionRepo.create({
      warehouseId,
      partId,
      transactionType,
      quantity: Math.abs(difference),
      notes: notes || `جرد: الكمية الفعلية ${actualQuantity}، الكمية الحالية ${currentStock}`,
      status: 'completed',
      createdBy
    });

    await this.partRepo.updateStock(partId, difference);

    // ✅ جديد: لو الجرد زوّد الرصيد، وفّر تلقائيًا لأي أمر صيانة محتاج القطعة دي
    if (difference > 0) {
      await syncMaintenanceNeededParts(
        { partRepo: this.partRepo, transactionRepo: this.transactionRepo, maintenanceRepo: this.maintenanceRepo },
        partId,
        warehouseId,
        createdBy
      );
    }

    logger.info(`Inventory count completed for part: ${partId}`);
    return transaction;
  }
}