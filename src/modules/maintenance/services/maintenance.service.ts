// src/modules/maintenance/services/maintenance.service.ts
import {
  MaintenanceOrderRepository,
  WorkshopRepository,
  MaintenanceTypeRepository
} from '../repositories/maintenance.repository';
import {
  MaintenanceOrder,
  CreateMaintenanceDTO,
  UpdateMaintenanceDTO,
  Workshop,
  CreateWorkshopDTO,
  MaintenanceType,
  MaintenancePart,
  MaintenancePartUsed,
  CreateMaintenancePartDTO,
  ScheduledMaintenance,
  CreateScheduledMaintenanceDTO,
  UpdateScheduledMaintenanceDTO
} from '../models/maintenance.model';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';
import { PurchaseRequestRepository } from '../../purchasing/repositories/purchasing.repository';
import { PurchaseOrderRepository } from '../../purchasing/repositories/purchasing.repository';
import { ReceivingNoteRepository } from '../../purchasing/repositories/purchasing.repository';
import { PartRepository } from '../../inventory/repositories/inventory.repository';
import { InventoryTransactionRepository } from '../../inventory/repositories/inventory.repository';
import { SupplierRepository } from '../../suppliers/repositories/supplier.repository';
import { ScheduledMaintenanceRepository } from '../repositories/scheduled-maintenance.repository';

type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'pending_parts' | 'parts_ordered' | 'parts_received';

export class MaintenanceService {
  constructor(
    private orderRepo: MaintenanceOrderRepository,
    private workshopRepo: WorkshopRepository,
    private typeRepo: MaintenanceTypeRepository,
    private vehicleRepo: VehicleRepository,
    private purchaseRequestRepo?: PurchaseRequestRepository,
    private purchaseOrderRepo?: PurchaseOrderRepository,
    private receivingNoteRepo?: ReceivingNoteRepository,
    private partRepo?: PartRepository,
    private transactionRepo?: InventoryTransactionRepository,
    private supplierRepo?: SupplierRepository,
    private scheduledRepo?: ScheduledMaintenanceRepository
  ) {}

  // ============================================================
  // ===== Maintenance Order Methods =====
  // ============================================================
  async createOrder(data: CreateMaintenanceDTO): Promise<MaintenanceOrder> {
    // ✅ رقم طلب الإصلاح يُدخل يدوياً
    if (!data.orderNumber || !String(data.orderNumber).trim()) {
      throw new AppError('رقم طلب الإصلاح مطلوب', 400);
    }

    const existing = await this.orderRepo.findByOrderNumber(data.orderNumber);
    if (existing) {
      throw new AppError('Maintenance order with this number already exists', 409);
    }

    const vehicle = await this.vehicleRepo.findById(data.vehicleId);
    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }

    await this.vehicleRepo.updateStatus(data.vehicleId, 'under_maintenance');

    const partsNeeded: MaintenancePart[] = (data.partsNeeded || []).map(part => ({
      ...part,
      status: 'pending' as const,
    }));

    const order = await this.orderRepo.create({
      ...data,
      laborCost: data.laborCost || 0,
      partsCost: 0,
      totalCost: 0,
      priority: data.priority || 'medium',
      status: 'scheduled',
      approvalStatus: 'pending',
      isUnderWarranty: false,
      partsNeeded: partsNeeded,
      version: 1
    });

    logger.info(`Maintenance order created: ${order.orderNumber} (${order.id})`);
    return order;
  }

  async getOrder(id: string): Promise<MaintenanceOrder> {
    const order = await this.orderRepo.findById(id);
    if (!order) {
      throw new AppError('Maintenance order not found', 404);
    }
    return order;
  }

  async getAllOrders(filter?: any): Promise<MaintenanceOrder[]> {
    return this.orderRepo.findAll({ filter });
  }

  async updateOrder(id: string, data: UpdateMaintenanceDTO): Promise<MaintenanceOrder> {
    const current = await this.getOrder(id);

    const updateData: any = { ...data };

    // ============================================================
    // ✅ قاعدة الحالة حسب توفر قطع الغيار:
    // - متوفرة  => يمكن تغيير الحالة يدوياً
    // - غير متوفرة => الحالة تلقائية (pending_parts)
    // ============================================================
    const partsAvailable =
      (data as any).partsAvailable !== undefined
        ? (data as any).partsAvailable
        : (current as any).partsAvailable;

    if (partsAvailable === false) {
      updateData.status = 'pending_parts';
    }

    if (updateData.status === 'completed') {
      await this.vehicleRepo.updateStatus(current.vehicleId, 'available');
    }
    if (data.partsNeeded) {
      updateData.partsNeeded = data.partsNeeded.map(part => ({
        ...part,
        status: 'pending' as const,
      }));
    }

    const updated = await this.orderRepo.update(id, updateData);
    if (!updated) {
      throw new AppError('Failed to update maintenance order', 500);
    }

    logger.info(`Maintenance order updated: ${updated.orderNumber}`);
    return updated;
  }

  async deleteOrder(id: string): Promise<boolean> {
    await this.getOrder(id);
    const result = await this.orderRepo.softDelete(id);
    logger.info(`Maintenance order deleted: ${id}`);
    return result;
  }

  async startOrder(id: string): Promise<MaintenanceOrder> {
    const order = await this.getOrder(id);
    if (order.status !== 'scheduled') {
      throw new AppError('Order cannot be started. Status must be scheduled', 400);
    }

    const updated = await this.orderRepo.updateStatus(id, 'in_progress');
    if (!updated) {
      throw new AppError('Failed to start order', 500);
    }

    logger.info(`Maintenance order started: ${updated.orderNumber}`);
    return updated;
  }

  async completeOrder(id: string, endKM: number, totalCost: number): Promise<MaintenanceOrder> {
    const order = await this.getOrder(id);
    if (order.status !== 'in_progress') {
      throw new AppError('Order cannot be completed. Status must be in_progress', 400);
    }

    if (endKM < order.startKM) {
      throw new AppError('End KM cannot be less than Start KM', 400);
    }

    const updated = await this.orderRepo.completeOrder(id, endKM, totalCost);
    if (!updated) {
      throw new AppError('Failed to complete order', 500);
    }

    await this.vehicleRepo.updateStatus(order.vehicleId, 'available');
    await this.vehicleRepo.updateKM(order.vehicleId, endKM);

    logger.info(`Maintenance order completed: ${updated.orderNumber}`);
    return updated;
  }

  async cancelOrder(id: string, reason: string): Promise<MaintenanceOrder> {
    const order = await this.getOrder(id);
    if (order.status === 'completed') {
      throw new AppError('Cannot cancel a completed order', 400);
    }

    const updated = await this.orderRepo.updateStatus(id, 'cancelled');
    if (!updated) {
      throw new AppError('Failed to cancel order', 500);
    }

    await this.vehicleRepo.updateStatus(order.vehicleId, 'available');

    logger.info(`Maintenance order cancelled: ${updated.orderNumber}`);
    return updated;
  }

  async approveOrder(id: string, approvedBy: string): Promise<MaintenanceOrder> {
    const order = await this.getOrder(id);
    if (order.approvalStatus === 'approved') {
      throw new AppError('Order already approved', 400);
    }

    const updated = await this.orderRepo.approveOrder(id, approvedBy);
    if (!updated) {
      throw new AppError('Failed to approve order', 500);
    }

    logger.info(`Maintenance order approved: ${updated.orderNumber}`);
    return updated;
  }

  async rejectOrder(id: string, reason: string): Promise<MaintenanceOrder> {
    const order = await this.getOrder(id);
    if (order.approvalStatus === 'rejected') {
      throw new AppError('Order already rejected', 400);
    }

    const updated = await this.orderRepo.rejectOrder(id, reason);
    if (!updated) {
      throw new AppError('Failed to reject order', 500);
    }

    logger.info(`Maintenance order rejected: ${updated.orderNumber}`);
    return updated;
  }

  async getOrdersByVehicle(vehicleId: string): Promise<MaintenanceOrder[]> {
    return this.orderRepo.findByVehicle(vehicleId);
  }

  async getOrdersByStatus(status: string): Promise<MaintenanceOrder[]> {
    return this.orderRepo.findByStatus(status);
  }

  // ============================================================
  // ===== Parts Management Methods =====
  // ============================================================

  async addPartsNeeded(orderId: string, parts: CreateMaintenancePartDTO[]): Promise<MaintenanceOrder> {
    const order = await this.getOrder(orderId);

    const partsNeeded: MaintenancePart[] = parts.map(part => ({
      ...part,
      status: 'pending' as const,
    }));

    const updated = await this.orderRepo.update(orderId, {
      partsNeeded: [...(order.partsNeeded || []), ...partsNeeded],
      status: 'pending_parts',
    });

    if (!updated) {
      throw new AppError('Failed to add parts', 500);
    }

    logger.info(`Parts added to maintenance order: ${orderId}`);
    return updated;
  }

  async createPurchaseRequestFromMaintenance(orderId: string, requesterId: string): Promise<any> {
    if (!this.purchaseRequestRepo) {
      throw new AppError('Purchase request repository not initialized', 500);
    }

    const order = await this.getOrder(orderId);

    if (!order.partsNeeded || order.partsNeeded.length === 0) {
      throw new AppError('No parts needed for this maintenance order', 400);
    }

    if (order.purchaseRequestId) {
      const existingRequest = await this.purchaseRequestRepo.findById(order.purchaseRequestId);
      if (existingRequest) {
        throw new AppError('Purchase request already created for this maintenance order', 400);
      }
    }

    const purchaseRequest = await this.purchaseRequestRepo.create({
      requestNumber: `PR-MNT-${Date.now()}`,
      maintenanceOrderId: orderId,
      items: order.partsNeeded.map(part => ({
        partId: part.partId,
        quantity: part.quantity,
        unitPrice: part.estimatedPrice || 0,
        notes: part.notes || `Required for maintenance order ${order.orderNumber}`,
      })),
      priority: 'high',
      status: 'pending',
      requesterId: requesterId,
      purpose: `قطع غيار مطلوبة لأمر الصيانة رقم ${order.orderNumber}`,
      requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await this.orderRepo.update(orderId, {
      purchaseRequestId: purchaseRequest.id,
      status: 'parts_ordered',
    });

    logger.info(`Purchase request created from maintenance order: ${orderId}`);
    return purchaseRequest;
  }

  // تحديث حالة أمر الصيانة بناءً على حالة طلب الشراء
  async updateOrderRequestStatus(orderId: string, requestStatus: string): Promise<MaintenanceOrder> {
    const order = await this.getOrder(orderId);

    let newStatus: MaintenanceStatus = order.status as MaintenanceStatus;
    const statusMap: Record<string, MaintenanceStatus> = {
      'pending': 'pending_parts',
      'approved': 'pending_parts',
      'rejected': 'pending_parts',
      'converted': 'parts_ordered'
    };

    if (requestStatus in statusMap) {
      newStatus = statusMap[requestStatus];
    }

    const updated = await this.orderRepo.update(orderId, {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    if (!updated) {
      throw new AppError('Failed to update order status', 500);
    }

    logger.info(`Maintenance order ${orderId} status updated to ${newStatus} (request status: ${requestStatus})`);
    return updated;
  }

  // ✅ FIX: MaintenancePartUsed يتطلب partName, partCode, unit كحقول أساسية
  //         ولا يحتوي على stockAvailable أصلاً — ده كان سبب الخطأ
  async updateOrderWithReceivedParts(
    orderId: string,
    receivedItems: Array<{
      partId: string;
      quantity: number;
      unitPrice: number;
      partName?: string;
    }>,
    receivingNumber: string,
    supplierId?: string
  ): Promise<MaintenanceOrder> {
    const order = await this.getOrder(orderId);

    const updatedPartsUsed: MaintenancePartUsed[] = [...(order.partsUsed || [])];
    const updatedPartsNeeded: MaintenancePart[] = [...(order.partsNeeded || [])];
    let totalPartsCost = 0;

    for (const receivedItem of receivedItems) {
      const neededIndex = updatedPartsNeeded.findIndex(p => p.partId === receivedItem.partId);
      const needed = neededIndex !== -1 ? updatedPartsNeeded[neededIndex] : undefined;

      // partName, partCode, unit مطلوبين في MaintenancePartUsed
      let partName = receivedItem.partName || needed?.partName || 'قطعة';
      let partCode = needed?.partCode || '';
      let unit = needed?.unit || 'قطعة';

      if ((!partName || partName === 'قطعة') && this.partRepo) {
        try {
          const part = await this.partRepo.findById(receivedItem.partId);
          if (part) {
            partName = (part as any).name || (part as any).partName || 'قطعة';
            partCode = partCode || (part as any).code || (part as any).partCode || '';
            unit = unit === 'قطعة' ? ((part as any).unit || unit) : unit;
          }
        } catch (e) {
          // تجاهل
        }
      }

      if (needed) {
        const usedQuantity = Math.min(needed.quantity, receivedItem.quantity);
        const remainingQuantity = needed.quantity - usedQuantity;
        const unitPrice = receivedItem.unitPrice || needed.estimatedPrice || 0;

        updatedPartsUsed.push({
          partId: receivedItem.partId,
          partName,
          partCode,
          quantity: usedQuantity,
          unit,
          price: unitPrice,
          totalPrice: unitPrice * usedQuantity,
        });

        totalPartsCost += unitPrice * usedQuantity;

        if (remainingQuantity > 0) {
          updatedPartsNeeded[neededIndex].quantity = remainingQuantity;
        } else {
          updatedPartsNeeded.splice(neededIndex, 1);
        }
      } else {
        const unitPrice = receivedItem.unitPrice || 0;

        updatedPartsUsed.push({
          partId: receivedItem.partId,
          partName,
          partCode,
          quantity: receivedItem.quantity,
          unit,
          price: unitPrice,
          totalPrice: unitPrice * receivedItem.quantity,
        });

        totalPartsCost += unitPrice * receivedItem.quantity;
      }
    }

    const laborCost = order.laborCost || 0;
    const totalCost = laborCost + totalPartsCost;

    let newStatus: MaintenanceStatus = order.status as MaintenanceStatus;
    if (updatedPartsNeeded.length === 0) {
      newStatus = 'parts_received';
    } else {
      newStatus = 'pending_parts';
    }

    const updated = await this.orderRepo.update(orderId, {
      partsUsed: updatedPartsUsed,
      partsNeeded: updatedPartsNeeded,
      partsCost: totalPartsCost,
      totalCost: totalCost,
      status: newStatus,
      receivingNoteId: receivingNumber,
      updatedAt: new Date().toISOString()
    });

    if (!updated) {
      throw new AppError('Failed to update order with received parts', 500);
    }

    logger.info(`Maintenance order ${orderId} updated with received parts. Status: ${newStatus}, Total cost: ${totalCost}`);
    return updated;
  }

  async createPurchaseOrderFromMaintenance(
    orderId: string,
    supplierId: string,
    createdBy: string
  ): Promise<any> {
    if (!this.purchaseOrderRepo) {
      throw new AppError('Purchase order repository not initialized', 500);
    }

    const order = await this.getOrder(orderId);

    if (!order.partsNeeded || order.partsNeeded.length === 0) {
      throw new AppError('No parts needed for this maintenance order', 400);
    }

    if (order.purchaseOrderId) {
      const existingOrder = await this.purchaseOrderRepo.findById(order.purchaseOrderId);
      if (existingOrder) {
        throw new AppError('Purchase order already created for this maintenance order', 400);
      }
    }

    if (!this.supplierRepo) {
      throw new AppError('Supplier repository not initialized', 500);
    }
    const supplier = await this.supplierRepo.findById(supplierId);
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    const items = order.partsNeeded.map(part => ({
      partId: part.partId,
      quantity: part.quantity,
      unitPrice: part.estimatedPrice || 0,
      notes: part.notes || `For maintenance order ${order.orderNumber}`,
      totalPrice: (part.quantity || 0) * (part.estimatedPrice || 0),
      receivedQuantity: 0
    }));

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const isTaxable = supplier.isTaxable || false;
    const taxRate = isTaxable ? 14 : 0;
    const taxAmount = isTaxable ? (subtotal * taxRate) / 100 : 0;
    const total = subtotal + taxAmount;

    const purchaseOrder = await this.purchaseOrderRepo.create({
      orderNumber: `PO-MNT-${Date.now()}`,
      supplierId: supplierId,
      supplierName: supplier.name,
      supplierIsTaxable: isTaxable,
      taxRate: taxRate,
      taxAmount: taxAmount,
      subtotal: subtotal,
      total: total,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: items,
      status: 'draft',
      maintenanceOrderId: orderId,
      createdBy: createdBy,
      version: 1,
      isDeleted: false
    });

    await this.orderRepo.update(orderId, {
      purchaseOrderId: purchaseOrder.id,
      status: 'parts_ordered',
    });

    logger.info(`Purchase order created from maintenance: ${purchaseOrder.orderNumber}`);
    return purchaseOrder;
  }

  async receivePartsForMaintenance(
    orderId: string,
    warehouseId: string,
    receivedBy: string,
    notes?: string
  ): Promise<any> {
    if (!this.receivingNoteRepo || !this.transactionRepo || !this.partRepo) {
      throw new AppError('Required repositories not initialized', 500);
    }

    const order = await this.getOrder(orderId);

    if (!order.purchaseOrderId) {
      throw new AppError('No purchase order linked to this maintenance order', 400);
    }

    const purchaseOrder = await this.purchaseOrderRepo?.findById(order.purchaseOrderId);
    if (!purchaseOrder) {
      throw new AppError('Purchase order not found', 404);
    }

    const receivingNumber = `RN-MNT-${Date.now()}`;

    const receivingNote = await this.receivingNoteRepo.create({
      receivingNumber: receivingNumber,
      orderId: purchaseOrder.id,
      supplierId: purchaseOrder.supplierId,
      supplierName: purchaseOrder.supplierName,
      invoiceNumber: `INV-${Date.now()}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      receivingDate: new Date().toISOString().split('T')[0],
      warehouseId: warehouseId,
      receivedBy: receivedBy,
      notes: notes || `Received for maintenance order ${order.orderNumber}`,
      items: purchaseOrder.items.map(item => ({
        partId: item.partId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
        notes: item.notes,
      })),
      status: 'completed',
      createdBy: receivedBy,
      version: 1,
      isDeleted: false
    });

    for (const item of purchaseOrder.items) {
      await this.transactionRepo.create({
        warehouseId: warehouseId,
        partId: item.partId,
        transactionType: 'receiving',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        referenceType: 'maintenance_order',
        referenceId: orderId,
        notes: `Received for maintenance order ${order.orderNumber}`,
        status: 'completed',
        createdBy: receivedBy
      });

      await this.partRepo.updateStock(item.partId, item.quantity);
    }

    await this.orderRepo.update(orderId, {
      receivingNoteId: receivingNote.id,
      status: 'parts_received',
    });

    logger.info(`Parts received for maintenance order: ${orderId}`);
    return receivingNote;
  }

  async receivePartsFromInventory(orderId: string, receivingNoteId: string): Promise<MaintenanceOrder> {
    const order = await this.getOrder(orderId);

    const partsNeeded = order.partsNeeded?.map(part => ({
      ...part,
      status: 'received' as const,
    })) || [];

    const updated = await this.orderRepo.update(orderId, {
      receivingNoteId: receivingNoteId,
      partsNeeded: partsNeeded,
      status: 'parts_received',
    });

    if (!updated) {
      throw new AppError('Failed to receive parts', 500);
    }

    logger.info(`Parts received for maintenance order: ${orderId}`);
    return updated;
  }

  async usePartsFromInventory(orderId: string, partsUsed: MaintenancePartUsed[], warehouseId: string, createdBy: string): Promise<MaintenanceOrder> {
    if (!this.partRepo || !this.transactionRepo) {
      throw new AppError('Inventory repositories not initialized', 500);
    }

    const order = await this.getOrder(orderId);

    for (const part of partsUsed) {
      const inventoryItem = await this.partRepo.findById(part.partId);
      if (!inventoryItem) {
        throw new AppError(`Part ${part.partId} not found in inventory`, 404);
      }
      if (inventoryItem.currentStock < part.quantity) {
        throw new AppError(`Insufficient stock for part ${part.partId}. Available: ${inventoryItem.currentStock}`, 400);
      }
    }

    const transactions = [];
    for (const part of partsUsed) {
      const transaction = await this.transactionRepo.create({
        warehouseId: warehouseId,
        partId: part.partId,
        transactionType: 'issue',
        quantity: part.quantity,
        unitPrice: part.price,
        referenceType: 'maintenance_order',
        referenceId: orderId,
        notes: `Used for maintenance order ${order.orderNumber}`,
        status: 'completed',
        createdBy: createdBy,
      });
      transactions.push(transaction);

      await this.partRepo.updateStock(part.partId, -part.quantity);
    }

    const totalPartsCost = partsUsed.reduce((sum, part) => sum + (part.totalPrice || 0), 0);

    const updated = await this.orderRepo.update(orderId, {
      partsUsed: partsUsed,
      partsCost: totalPartsCost,
      totalCost: (order.laborCost || 0) + totalPartsCost,
      status: 'completed',
    });

    if (!updated) {
      throw new AppError('Failed to use parts', 500);
    }

    await this.vehicleRepo.updateStatus(order.vehicleId, 'available');

    logger.info(`Parts used for maintenance order: ${orderId}`);
    return updated;
  }

  async completeOrderWithParts(id: string, endKM: number, partsUsed: MaintenancePartUsed[], warehouseId: string, createdBy: string): Promise<MaintenanceOrder> {
    const order = await this.usePartsFromInventory(id, partsUsed, warehouseId, createdBy);

    const completed = await this.orderRepo.completeOrder(id, endKM, order.totalCost);
    if (!completed) {
      throw new AppError('Failed to complete order', 500);
    }

    await this.vehicleRepo.updateStatus(order.vehicleId, 'available');
    await this.vehicleRepo.updateKM(order.vehicleId, endKM);

    logger.info(`Maintenance order completed with parts: ${completed.orderNumber}`);
    return completed;
  }

  async returnPartsFromMaintenance(orderId: string, partId: string, quantity: number, warehouseId: string, createdBy: string): Promise<any> {
    if (!this.partRepo || !this.transactionRepo) {
      throw new AppError('Inventory repositories not initialized', 500);
    }

    const part = await this.partRepo.findById(partId);
    if (!part) {
      throw new AppError('Part not found', 404);
    }

    const transaction = await this.transactionRepo.create({
      warehouseId: warehouseId,
      partId: partId,
      transactionType: 'return',
      quantity: quantity,
      referenceType: 'maintenance_order',
      referenceId: orderId,
      notes: `Return from maintenance order ${orderId}`,
      status: 'completed',
      createdBy: createdBy,
    });

    await this.partRepo.updateStock(partId, quantity);

    logger.info(`Parts returned from maintenance: ${orderId}`);
    return transaction;
  }

  // ============================================================
  // ===== Workshop Methods =====
  // ============================================================
  async createWorkshop(data: CreateWorkshopDTO): Promise<Workshop> {
    const existing = await this.workshopRepo.findByCode(data.code);
    if (existing) {
      throw new AppError('Workshop with this code already exists', 409);
    }

    const workshop = await this.workshopRepo.create({
      ...data,
      isApproved: true,
      isActive: true,
      version: 1,
      isDeleted: false
    });

    logger.info(`Workshop created: ${workshop.code}`);
    return workshop;
  }

  async getWorkshop(id: string): Promise<Workshop> {
    const workshop = await this.workshopRepo.findById(id);
    if (!workshop) {
      throw new AppError('Workshop not found', 404);
    }
    return workshop;
  }

  async getAllWorkshops(): Promise<Workshop[]> {
    return this.workshopRepo.findAll();
  }

  async updateWorkshop(id: string, data: Partial<Workshop>): Promise<Workshop> {
    await this.getWorkshop(id);
    const updated = await this.workshopRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update workshop', 500);
    }
    return updated;
  }

  async deleteWorkshop(id: string): Promise<boolean> {
    await this.getWorkshop(id);
    return this.workshopRepo.softDelete(id);
  }

  // ============================================================
  // ===== Maintenance Type Methods =====
  // ============================================================
  async createMaintenanceType(data: Partial<MaintenanceType>): Promise<MaintenanceType> {
    const existing = await this.typeRepo.findByCode(data.code!);
    if (existing) {
      throw new AppError('Maintenance type with this code already exists', 409);
    }

    const type = await this.typeRepo.create({
      ...data,
      isActive: true,
      version: 1,
      isDeleted: false
    });

    logger.info(`Maintenance type created: ${type.code}`);
    return type;
  }

  async getMaintenanceType(id: string): Promise<MaintenanceType> {
    const type = await this.typeRepo.findById(id);
    if (!type) {
      throw new AppError('Maintenance type not found', 404);
    }
    return type;
  }

  async getAllMaintenanceTypes(): Promise<MaintenanceType[]> {
    return this.typeRepo.findAll();
  }

  async updateMaintenanceType(id: string, data: Partial<MaintenanceType>): Promise<MaintenanceType> {
    await this.getMaintenanceType(id);
    const updated = await this.typeRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update maintenance type', 500);
    }
    return updated;
  }

  async deleteMaintenanceType(id: string): Promise<boolean> {
    await this.getMaintenanceType(id);
    return this.typeRepo.softDelete(id);
  }

  // ============================================================
  // ===== Scheduled Maintenance Methods =====
  // ============================================================

  async createScheduledMaintenance(data: CreateScheduledMaintenanceDTO): Promise<ScheduledMaintenance> {
    if (!this.scheduledRepo) {
      throw new AppError('Scheduled maintenance repository not initialized', 500);
    }

    let nextDueDate = data.scheduledDate;
    let nextDueKM = data.lastPerformedKM ? (data.lastPerformedKM + (data.intervalKM || 0)) : undefined;

    if (data.intervalDays && data.lastPerformedDate) {
      const lastDate = new Date(data.lastPerformedDate);
      lastDate.setDate(lastDate.getDate() + data.intervalDays);
      nextDueDate = lastDate.toISOString().split('T')[0];
    }

    const scheduled = await this.scheduledRepo.create({
      ...data,
      nextDueDate,
      nextDueKM,
      status: 'scheduled',
      isRecurring: data.isRecurring ?? false,
      version: 1,
      isDeleted: false
    });

    logger.info(`Scheduled maintenance created: ${scheduled.id}`);
    return scheduled;
  }

  async getScheduledMaintenance(id: string): Promise<ScheduledMaintenance> {
    if (!this.scheduledRepo) {
      throw new AppError('Scheduled maintenance repository not initialized', 500);
    }
    const scheduled = await this.scheduledRepo.findById(id);
    if (!scheduled) {
      throw new AppError('Scheduled maintenance not found', 404);
    }
    return scheduled;
  }

  async getAllScheduledMaintenance(filter?: any): Promise<ScheduledMaintenance[]> {
    if (!this.scheduledRepo) {
      throw new AppError('Scheduled maintenance repository not initialized', 500);
    }
    return this.scheduledRepo.findAll({ filter });
  }

  async updateScheduledMaintenance(id: string, data: UpdateScheduledMaintenanceDTO): Promise<ScheduledMaintenance> {
    if (!this.scheduledRepo) {
      throw new AppError('Scheduled maintenance repository not initialized', 500);
    }
    await this.getScheduledMaintenance(id);
    const updated = await this.scheduledRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update scheduled maintenance', 500);
    }
    return updated;
  }

  async deleteScheduledMaintenance(id: string): Promise<boolean> {
    if (!this.scheduledRepo) {
      throw new AppError('Scheduled maintenance repository not initialized', 500);
    }
    await this.getScheduledMaintenance(id);
    return this.scheduledRepo.softDelete(id);
  }

  async getUpcomingMaintenance(days: number = 7): Promise<ScheduledMaintenance[]> {
    if (!this.scheduledRepo) {
      throw new AppError('Scheduled maintenance repository not initialized', 500);
    }
    return this.scheduledRepo.findUpcoming(days);
  }

  async getOverdueMaintenance(): Promise<ScheduledMaintenance[]> {
    if (!this.scheduledRepo) {
      throw new AppError('Scheduled maintenance repository not initialized', 500);
    }
    return this.scheduledRepo.findOverdue();
  }

  async getMaintenanceByVehicle(vehicleId: string): Promise<ScheduledMaintenance[]> {
    if (!this.scheduledRepo) {
      throw new AppError('Scheduled maintenance repository not initialized', 500);
    }
    return this.scheduledRepo.findByVehicle(vehicleId);
  }

  async completeScheduledMaintenance(
    id: string,
    maintenanceOrderId: string,
    actualDate: string,
    lastPerformedKM: number
  ): Promise<ScheduledMaintenance> {
    if (!this.scheduledRepo) {
      throw new AppError('Scheduled maintenance repository not initialized', 500);
    }
    const scheduled = await this.getScheduledMaintenance(id);

    let nextDueDate: string | undefined;
    let nextDueKM: number | undefined;

    if (scheduled.isRecurring) {
      if (scheduled.intervalDays) {
        const nextDate = new Date(actualDate);
        nextDate.setDate(nextDate.getDate() + scheduled.intervalDays);
        nextDueDate = nextDate.toISOString().split('T')[0];
      }
      if (scheduled.intervalKM) {
        nextDueKM = lastPerformedKM + scheduled.intervalKM;
      }
    }

    const updated = await this.scheduledRepo.completeMaintenance(
      id,
      actualDate,
      lastPerformedKM,
      nextDueDate,
      nextDueKM
    );

    if (!updated) {
      throw new AppError('Failed to complete scheduled maintenance', 500);
    }

    logger.info(`Scheduled maintenance completed: ${id}`);
    return updated;
  }

  async checkDueMaintenanceByKM(vehicleId: string, currentKM: number): Promise<ScheduledMaintenance[]> {
    if (!this.scheduledRepo) {
      throw new AppError('Scheduled maintenance repository not initialized', 500);
    }
    return this.scheduledRepo.findDueByKM(vehicleId, currentKM);
  }

  // ============================================================
  // ===== Scheduled Maintenance Stats =====
  // ============================================================

  async getScheduledStats(): Promise<{
    total: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    skipped: number;
    overdue: number;
  }> {
    if (!this.scheduledRepo) {
      throw new AppError('Scheduled maintenance repository not initialized', 500);
    }
    return this.scheduledRepo.getScheduledStats();
  }

  // ============================================================
  // ===== Maintenance Request Status Tracking =====
  // ============================================================

  async getLinkedPurchaseRequestStatus(orderId: string): Promise<{
    requestId: string | null;
    status: string;
    approvalStatus: string;
    convertedToPO: boolean;
    items: any[];
  } | null> {
    const order = await this.getOrder(orderId);

    if (!order.purchaseRequestId || !this.purchaseRequestRepo) {
      return null;
    }

    const request = await this.purchaseRequestRepo.findById(order.purchaseRequestId);
    if (!request) {
      return null;
    }

    return {
      requestId: request.id,
      status: request.status || 'pending',
      approvalStatus: request.approvalStatus || 'pending',
      convertedToPO: request.convertedToPO || false,
      items: request.items || []
    };
  }

  async getLinkedPurchaseOrder(orderId: string): Promise<any | null> {
    const order = await this.getOrder(orderId);

    if (!order.purchaseOrderId || !this.purchaseOrderRepo) {
      return null;
    }

    return await this.purchaseOrderRepo.findById(order.purchaseOrderId);
  }

  async getLinkedReceivingNote(orderId: string): Promise<any | null> {
    const order = await this.getOrder(orderId);

    if (!order.receivingNoteId || !this.receivingNoteRepo) {
      return null;
    }

    return await this.receivingNoteRepo.findById(order.receivingNoteId);
  }

  async syncWithPurchasing(orderId: string): Promise<MaintenanceOrder> {
    const order = await this.getOrder(orderId);

    const requestStatus = await this.getLinkedPurchaseRequestStatus(orderId);
    const purchaseOrder = await this.getLinkedPurchaseOrder(orderId);
    const receivingNote = await this.getLinkedReceivingNote(orderId);

    let newStatus: MaintenanceStatus = order.status as MaintenanceStatus;

    if (receivingNote) {
      newStatus = 'parts_received';
    } else if (purchaseOrder) {
      newStatus = 'parts_ordered';
    } else if (requestStatus && requestStatus.approvalStatus === 'approved') {
      newStatus = 'parts_ordered';
    } else if (requestStatus && requestStatus.approvalStatus === 'pending') {
      newStatus = 'pending_parts';
    }

    if (newStatus !== order.status) {
      const updated = await this.orderRepo.update(orderId, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      if (!updated) {
        throw new AppError('Failed to sync maintenance order with purchasing', 500);
      }

      logger.info(`Maintenance order ${orderId} synced with purchasing. New status: ${newStatus}`);
      return updated;
    }

    return order;
  }
}