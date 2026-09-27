import {
  SupplierRepository,
  PurchaseRequestRepository,
  PurchaseOrderRepository,
  ReceivingNoteRepository
} from '../repositories/purchasing.repository';
import {
  Supplier,
  CreateSupplierDTO,
  PurchaseRequest,
  CreatePurchaseRequestDTO,
  PurchaseOrder,
  CreatePurchaseOrderDTO,
  ReceivingNote,
  CreateReceivingNoteDTO,
  CreateReceivingItemDTO,
  PurchaseRequestItem,
  PurchaseOrderItem,
  ReceivingItem,
  PurchaseRequestWithMaintenance,
  CreateOrderFromRequestDTO,
  ReceivePurchaseOrderDTO,
  ReceiveOrderItemDTO,
  CommercialRegisterExpiryResult,
  SupplierStats,
  PurchaseOrderWithSupplier,
  ReceivingNoteWithDetails,
  UpdatePartStockDTO,
  PurchaseRequestFilter,
  PurchaseOrderFilter,
  ReceivingNoteFilter
} from '../models/purchasing.model';
import { PartRepository } from '../../inventory/repositories/inventory.repository';
import { InventoryTransactionRepository } from '../../inventory/repositories/inventory.repository';
import { WarehouseRepository } from '../../inventory/repositories/inventory.repository';
import { MaintenanceOrderRepository } from '../../maintenance/repositories/maintenance.repository';
import { MaintenanceOrder } from '../../maintenance/models/maintenance.model';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';
import { syncMaintenanceNeededParts } from '../../inventory/services/maintenance-parts-sync.util';

export class PurchasingService {
  constructor(
    private supplierRepo: SupplierRepository,
    private requestRepo: PurchaseRequestRepository,
    private orderRepo: PurchaseOrderRepository,
    private receivingRepo: ReceivingNoteRepository,
    private partRepo: PartRepository,
    private transactionRepo: InventoryTransactionRepository,
    private warehouseRepo: WarehouseRepository,
    private maintenanceRepo?: MaintenanceOrderRepository,
    private vehicleRepo?: VehicleRepository
  ) {}

  // ============================================================
  // ===== Supplier Methods =====
  // ============================================================
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

    logger.info(`Supplier created: ${supplier.code}`);
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

  async updateSupplier(id: string, data: Partial<Supplier>): Promise<Supplier> {
    await this.getSupplier(id);
    const updated = await this.supplierRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update supplier', 500);
    }
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

  async checkCommercialRegisterExpiry(supplierId: string): Promise<CommercialRegisterExpiryResult> {
    const supplier = await this.getSupplier(supplierId);
    if (!supplier.commercialRegisterExpiry) {
      return { isExpired: false };
    }
    const today = new Date().toISOString().split('T')[0];
    const isExpired = supplier.commercialRegisterExpiry <= today;

    const expiryDate = new Date(supplier.commercialRegisterExpiry);
    const todayDate = new Date();
    const diffTime = expiryDate.getTime() - todayDate.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      isExpired,
      expiryDate: supplier.commercialRegisterExpiry,
      daysRemaining: daysRemaining > 0 ? daysRemaining : 0
    };
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

  async getSupplierStats(): Promise<SupplierStats> {
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

  // ============================================================
  // ===== Purchase Request Methods =====
  // ============================================================
  async createPurchaseRequest(data: CreatePurchaseRequestDTO): Promise<PurchaseRequest> {
    const existing = await this.requestRepo.findByRequestNumber(data.requestNumber);
    if (existing) {
      throw new AppError('Purchase request with this number already exists', 409);
    }

    for (const item of data.items) {
      const part = await this.partRepo.findById(item.partId);
      if (!part) {
        throw new AppError(`Part ${item.partId} not found`, 404);
      }
    }

    const request = await this.requestRepo.create({
      ...data,
      priority: data.priority || 'medium',
      status: 'pending',
      approvalStatus: 'pending',
      version: 1,
      isDeleted: false,
      convertedToPO: false,
      items: data.items.map(item => ({
        ...item,
        status: 'pending' as const,
      })),
    });

    logger.info(`Purchase request created: ${request.requestNumber}`);
    return request;
  }

  async updatePurchaseRequest(id: string, data: Partial<PurchaseRequest>): Promise<PurchaseRequest> {
    await this.getPurchaseRequest(id);
    const updated = await this.requestRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update purchase request', 500);
    }
    logger.info(`Purchase request updated: ${updated.requestNumber}`);
    return updated;
  }

  async deletePurchaseRequest(id: string): Promise<boolean> {
    await this.getPurchaseRequest(id);
    return this.requestRepo.softDelete(id);
  }

  async getPurchaseRequestsByMaintenance(maintenanceOrderId: string): Promise<PurchaseRequest[]> {
    return this.requestRepo.findAll({
      filter: { maintenanceOrderId },
      sort: { createdAt: 'desc' }
    });
  }

  async createPurchaseRequestFromMaintenance(
    maintenanceOrderId: string,
    requesterId: string
  ): Promise<PurchaseRequest> {
    if (!this.maintenanceRepo) {
      throw new AppError('Maintenance repository not initialized', 500);
    }

    const maintenanceOrder = await this.maintenanceRepo.findById(maintenanceOrderId);
    if (!maintenanceOrder) {
      throw new AppError('Maintenance order not found', 404);
    }

    if (!maintenanceOrder.partsNeeded || maintenanceOrder.partsNeeded.length === 0) {
      throw new AppError('No parts needed for this maintenance order', 400);
    }

    if (maintenanceOrder.purchaseRequestId) {
      const existingRequest = await this.requestRepo.findById(maintenanceOrder.purchaseRequestId);
      if (existingRequest) {
        throw new AppError('Purchase request already created for this maintenance order', 400);
      }
    }

    const items = maintenanceOrder.partsNeeded.map(part => ({
      partId: part.partId,
      quantity: part.quantity,
      unitPrice: part.estimatedPrice || 0,
      notes: part.notes || `Required for maintenance order ${maintenanceOrder.orderNumber}`,
    }));

    const requestNumber = `PR-MNT-${Date.now()}`;

    const request = await this.requestRepo.create({
      requestNumber: requestNumber,
      maintenanceOrderId: maintenanceOrderId,
      requesterId: requesterId,
      priority: 'high',
      requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      purpose: `قطع غيار مطلوبة لأمر الصيانة رقم ${maintenanceOrder.orderNumber}`,
      status: 'pending',
      approvalStatus: 'pending',
      convertedToPO: false,
      items: items.map(item => ({
        ...item,
        status: 'pending' as const,
      })),
      version: 1,
      isDeleted: false
    });

    await this.maintenanceRepo.update(maintenanceOrderId, {
      purchaseRequestId: request.id,
      status: 'parts_ordered'
    });

    logger.info(`Purchase request created from maintenance order: ${request.requestNumber}`);
    return request;
  }

  async getPurchaseRequest(id: string): Promise<PurchaseRequest> {
    const request = await this.requestRepo.findById(id);
    if (!request) {
      throw new AppError('Purchase request not found', 404);
    }
    return request;
  }

  async getPurchaseRequestWithMaintenance(id: string): Promise<PurchaseRequestWithMaintenance | null> {
    const request = await this.getPurchaseRequest(id);
    if (!request) {
      return null;
    }

    let maintenanceOrder = undefined;
    if (request.maintenanceOrderId && this.maintenanceRepo) {
      const order = await this.maintenanceRepo.findById(request.maintenanceOrderId);
      if (order) {
        let vehiclePlate: string | undefined;
        if (this.vehicleRepo) {
          const vehicle = await this.vehicleRepo.findById(order.vehicleId);
          vehiclePlate = vehicle?.plateNumber;
        }
        maintenanceOrder = {
          orderNumber: order.orderNumber,
          vehicleId: order.vehicleId,
          vehiclePlate: vehiclePlate,
          problemDescription: order.problemDescription,
          status: order.status,
        };
      }
    }

    return {
      ...request,
      maintenanceOrder: maintenanceOrder,
    };
  }

  async getAllPurchaseRequests(filter?: PurchaseRequestFilter): Promise<PurchaseRequest[]> {
    return this.requestRepo.findAll({ filter });
  }

  async approvePurchaseRequest(id: string, approvedBy: string): Promise<PurchaseRequest> {
    const request = await this.getPurchaseRequest(id);
    if (request.approvalStatus !== 'pending') {
      throw new AppError('Request already processed', 400);
    }

    const updated = await this.requestRepo.approveRequest(id, approvedBy);
    if (!updated) {
      throw new AppError('Failed to approve request', 500);
    }

    // ✅ NEW: مزامنة أمر الصيانة تلقائياً فور الموافقة - مفيش داعي لـ polling من الفرونت إند
    if (updated.maintenanceOrderId) {
      await this.updateMaintenanceRequestStatus(updated.maintenanceOrderId, 'approved');
    }

    logger.info(`Purchase request approved: ${updated.requestNumber}`);
    return updated;
  }

  async rejectPurchaseRequest(id: string, reason: string): Promise<PurchaseRequest> {
    const request = await this.getPurchaseRequest(id);
    if (request.approvalStatus !== 'pending') {
      throw new AppError('Request already processed', 400);
    }

    const updated = await this.requestRepo.rejectRequest(id, reason);
    if (!updated) {
      throw new AppError('Failed to reject request', 500);
    }

    // ✅ NEW: مزامنة أمر الصيانة تلقائياً فور الرفض
    if (updated.maintenanceOrderId) {
      await this.updateMaintenanceRequestStatus(updated.maintenanceOrderId, 'rejected');
    }

    logger.info(`Purchase request rejected: ${updated.requestNumber}`);
    return updated;
  }

  async createOrderFromRequest(
    requestId: string,
    data: CreateOrderFromRequestDTO
  ): Promise<PurchaseOrder> {
    const request = await this.getPurchaseRequest(requestId);

    if (request.approvalStatus !== 'approved') {
      throw new AppError('Purchase request must be approved first', 400);
    }

    if (request.convertedToPO) {
      throw new AppError('This request has already been converted to a purchase order', 400);
    }

    const supplier = await this.supplierRepo.findById(data.supplierId);
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    if (!request.items || request.items.length === 0) {
      throw new AppError('Purchase request has no items to convert', 400);
    }

    const orderItems = request.items.map(item => ({
      partId: item.partId,
      quantity: item.quantity,
      unitPrice: item.unitPrice || 0,
      notes: item.notes || `From purchase request ${request.requestNumber}`
    }));

    const orderNumber = `PO-REQ-${Date.now()}`;

    const order = await this.createPurchaseOrder({
      orderNumber,
      supplierId: data.supplierId,
      orderDate: data.orderDate,
      expectedDeliveryDate: data.expectedDeliveryDate,
      items: orderItems,
      notes: `Created from purchase request ${request.requestNumber}`,
      purchaseRequestId: requestId,
      maintenanceOrderId: request.maintenanceOrderId
    });

    await this.requestRepo.update(requestId, {
      convertedToPO: true,
      status: 'converted'
    });

    // ✅ NEW: مزامنة أمر الصيانة تلقائياً فور تحويل الطلب لأمر شراء
    if (request.maintenanceOrderId) {
      await this.updateMaintenanceRequestStatus(request.maintenanceOrderId, 'converted');
    }

    logger.info(`Purchase order created from request: ${order.orderNumber}`);
    return order;
  }

  // ============================================================
  // ===== Purchase Order Methods =====
  // ============================================================
  async createPurchaseOrder(data: CreatePurchaseOrderDTO): Promise<PurchaseOrder> {
    const existing = await this.orderRepo.findByOrderNumber(data.orderNumber);
    if (existing) {
      throw new AppError('Purchase order with this number already exists', 409);
    }

    const supplier = await this.supplierRepo.findById(data.supplierId);
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    if (supplier.commercialRegisterExpiry) {
      const today = new Date().toISOString().split('T')[0];
      if (supplier.commercialRegisterExpiry <= today) {
        logger.warn(`Supplier ${supplier.code} has expired commercial register`);
      }
    }

    let subtotal = 0;
    const orderItems: PurchaseOrderItem[] = [];
    for (const item of data.items) {
      const part = await this.partRepo.findById(item.partId);
      if (!part) {
        throw new AppError(`Part ${item.partId} not found`, 404);
      }
      const totalPrice = item.quantity * item.unitPrice;
      subtotal += totalPrice;
      orderItems.push({
        ...item,
        totalPrice: totalPrice,
        receivedQuantity: 0,
      });
    }

    const isTaxable = supplier.isTaxable || false;
    const taxRate = isTaxable ? 14 : 0;
    const discount = data.discount || 0;
    const taxAmount = isTaxable ? (subtotal * taxRate) / 100 : 0;
    const total = subtotal - discount + taxAmount;

    const order = await this.orderRepo.create({
      ...data,
      supplierIsTaxable: isTaxable,
      taxRate: taxRate,
      taxAmount: taxAmount,
      subtotal: subtotal,
      discount: discount,
      total: total,
      items: orderItems,
      status: 'draft',
      version: 1,
      isDeleted: false
    });

    logger.info(`Purchase order created: ${order.orderNumber}`);
    return order;
  }

  async confirmPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const order = await this.getPurchaseOrder(id);
    if (order.status !== 'draft' && order.status !== 'sent') {
      throw new AppError('Order must be in draft or sent status to confirm', 400);
    }

    const updated = await this.orderRepo.updateStatus(id, 'confirmed');
    if (!updated) {
      throw new AppError('Failed to confirm purchase order', 500);
    }

    // ✅ NEW: مزامنة أمر الصيانة (لو موجود) - مجرد تأكيد إضافي، متسببش مشاكل لو مفيش صيانة مرتبطة
    if (updated.maintenanceOrderId && this.maintenanceRepo) {
      await this.syncMaintenanceWithPurchasing(updated.maintenanceOrderId).catch(err => {
        logger.error('Error syncing maintenance after order confirmation:', err);
      });
    }

    logger.info(`Purchase order confirmed: ${updated.orderNumber}`);
    return updated;
  }

  async cancelPurchaseOrder(id: string, reason: string): Promise<PurchaseOrder> {
    const order = await this.getPurchaseOrder(id);
    if (order.status === 'fully_received') {
      throw new AppError('Cannot cancel a fully received order', 400);
    }

    const updated = await this.orderRepo.updateStatus(id, 'cancelled');
    if (!updated) {
      throw new AppError('Failed to cancel purchase order', 500);
    }

    logger.info(`Purchase order cancelled: ${updated.orderNumber}`);
    return updated;
  }

  async createPurchaseOrderFromMaintenance(
    maintenanceOrderId: string,
    data: Omit<CreatePurchaseOrderDTO, 'items'>
  ): Promise<PurchaseOrder> {
    if (!this.maintenanceRepo) {
      throw new AppError('Maintenance repository not initialized', 500);
    }

    const maintenanceOrder = await this.maintenanceRepo.findById(maintenanceOrderId);
    if (!maintenanceOrder) {
      throw new AppError('Maintenance order not found', 404);
    }

    const partsNeeded = maintenanceOrder.partsNeeded || [];
    if (partsNeeded.length === 0) {
      throw new AppError('No parts needed for this maintenance order', 400);
    }

    const supplier = await this.supplierRepo.findById(data.supplierId);
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    const orderItems = partsNeeded.map(part => ({
      partId: part.partId,
      quantity: part.quantity,
      unitPrice: part.estimatedPrice || 0,
      notes: part.notes || `For maintenance order ${maintenanceOrder.orderNumber}`
    }));

    const orderNumber = `PO-MNT-${Date.now()}`;

    const order = await this.createPurchaseOrder({
      ...data,
      orderNumber: orderNumber,
      items: orderItems,
      maintenanceOrderId: maintenanceOrderId
    });

    await this.maintenanceRepo.update(maintenanceOrderId, {
      purchaseOrderId: order.id,
      status: 'parts_ordered'
    });

    logger.info(`Purchase order created from maintenance: ${order.orderNumber}`);
    return order;
  }

  async getPurchaseOrdersByMaintenance(maintenanceOrderId: string): Promise<PurchaseOrder[]> {
    return this.orderRepo.findAll({
      filter: { maintenanceOrderId },
      sort: { createdAt: 'desc' }
    });
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder> {
    if (!id || id === '' || id === 'undefined' || id === 'null') {
      logger.error(`❌ Invalid purchase order ID: ${id}`);
      throw new AppError('Invalid purchase order ID', 400);
    }

    logger.debug(`🔍 Looking for purchase order with ID: ${id}`);

    const order = await this.orderRepo.findById(id);
    if (!order) {
      logger.warn(`⚠️ Purchase order with ID ${id} not found`);

      try {
        const allOrders = await this.orderRepo.findAll({ limit: 5 });
        if (allOrders && allOrders.length > 0) {
          const orderIds = allOrders.map(o => o.id).join(', ');
          logger.debug(`📋 Available orders (first 5): ${orderIds}`);
        } else {
          logger.warn('⚠️ No purchase orders found in database');
        }
      } catch (debugError) {
        logger.debug('Could not fetch debug order list:', debugError);
      }

      throw new AppError(`Purchase order with ID ${id} not found`, 404);
    }

    logger.debug(`✅ Purchase order found: ${order.orderNumber}`);
    return order;
  }

  async getAllPurchaseOrders(filter?: PurchaseOrderFilter): Promise<PurchaseOrder[]> {
    return this.orderRepo.findAll({ filter });
  }

  async updatePurchaseOrder(id: string, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    await this.getPurchaseOrder(id);
    const updated = await this.orderRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update purchase order', 500);
    }
    return updated;
  }

  async deletePurchaseOrder(id: string): Promise<boolean> {
    await this.getPurchaseOrder(id);
    return this.orderRepo.softDelete(id);
  }

  // ============================================================
  // ===== Receiving Note Methods =====
  // ============================================================
  async createReceivingNote(data: CreateReceivingNoteDTO): Promise<ReceivingNote> {
    logger.debug('📦 Creating receiving note with data:', JSON.stringify(data, null, 2));

    const existing = await this.receivingRepo.findByReceivingNumber(data.receivingNumber);
    if (existing) {
      throw new AppError('Receiving note with this number already exists', 409);
    }

    const orderId = data.orderId || data.purchaseOrderId;
    if (!orderId) {
      throw new AppError('Order ID is required. Please provide orderId or purchaseOrderId.', 400);
    }

    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new AppError(`Purchase order with ID ${orderId} not found`, 404);
    }

    let warehouseId = data.warehouseId;

    if (!warehouseId) {
      warehouseId = await this.getDefaultWarehouse();
      logger.warn(`No warehouse provided, using default warehouse: ${warehouseId}`);
    }

    let warehouse;
    try {
      warehouse = await this.warehouseRepo.findById(warehouseId);
    } catch (error) {
      logger.error('Error finding warehouse:', error);
      throw new AppError(`Failed to find warehouse with ID ${warehouseId}`, 500);
    }

    if (!warehouse) {
      throw new AppError(`Warehouse with ID ${warehouseId} not found. Please create a warehouse first.`, 404);
    }

    const receivingItems: ReceivingItem[] = [];
    let totalAmount = 0;

    for (const item of data.items) {
      const part = await this.partRepo.findById(item.partId);
      if (!part) {
        throw new AppError(`Part ${item.partId} not found`, 404);
      }

      const totalPrice = item.quantity * item.unitPrice;
      totalAmount += totalPrice;

      receivingItems.push({
        ...item,
        totalPrice: totalPrice,
      });

      await this.transactionRepo.create({
        warehouseId: warehouseId,
        partId: item.partId,
        transactionType: 'receiving',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        referenceType: 'receiving_note',
        referenceId: data.receivingNumber,
        notes: item.notes || 'Received from purchase order',
        status: 'completed',
        createdBy: data.receivedBy || 'system'
      });

      await this.partRepo.updateStock(item.partId, item.quantity);

      // ✅ NEW: بمجرد ما القطعة دي تدخل المخزون، وفّرها تلقائيًا لأي أمر
      // صيانة تاني (غير المرتبط مباشرة بأمر الشراء ده) لسه محتاجها في
      // partsNeeded. ده بيغطي حالة إن نفس القطعة مطلوبة لأكتر من أمر صيانة.
      await syncMaintenanceNeededParts(
        { partRepo: this.partRepo, transactionRepo: this.transactionRepo, maintenanceRepo: this.maintenanceRepo },
        item.partId,
        warehouseId,
        data.receivedBy || 'system'
      );
    }

    await this.updateOrderItemsReceivedQuantity(orderId, data.items);

    const receivingNote = await this.receivingRepo.create({
      ...data,
      orderId: orderId,
      warehouseId: warehouseId,
      items: receivingItems,
      total: data.total || totalAmount,
      status: data.status || 'completed',
      version: 1,
      isDeleted: false
    });

    await this.updateOrderStatusAfterReceiving(orderId);

    // ✅ لو أمر الشراء مرتبط بأمر صيانة → تحديث الصيانة تلقائيًا بالكامل
    // (سحب القطع اللي اتستخدمت + حساب التكلفة + تحديث الحالة) - من غير أي تدخل بشري
    if (order && order.maintenanceOrderId) {
      await this.updateMaintenanceAfterReceiving(
        order.maintenanceOrderId,
        data.items,
        receivingNote.receivingNumber,
        order.supplierId,
        warehouseId // ✅ NEW: لازم للسحب التلقائي من نفس المخزن
      );
    }

    logger.info(`Receiving note created: ${receivingNote.receivingNumber}`);
    return receivingNote;
  }

  async updateReceivingNote(id: string, data: Partial<ReceivingNote>): Promise<ReceivingNote> {
    await this.getReceivingNote(id);
    const updated = await this.receivingRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update receiving note', 500);
    }
    return updated;
  }

  async completeReceivingNote(id: string): Promise<ReceivingNote> {
    const note = await this.getReceivingNote(id);
    if (note.status === 'completed') {
      throw new AppError('Receiving note already completed', 400);
    }
    if (note.status === 'cancelled') {
      throw new AppError('Cannot complete a cancelled receiving note', 400);
    }

    const updated = await this.receivingRepo.completeReceiving(id);
    if (!updated) {
      throw new AppError('Failed to complete receiving note', 500);
    }

    logger.info(`Receiving note completed: ${updated.receivingNumber}`);
    return updated;
  }

  async deleteReceivingNote(id: string): Promise<boolean> {
    await this.getReceivingNote(id);
    return this.receivingRepo.softDelete(id);
  }

  async getReceivingNotesByOrder(orderId: string): Promise<ReceivingNote[]> {
    return this.receivingRepo.findByOrder(orderId);
  }

  async getReceivingNote(id: string): Promise<ReceivingNote> {
    const note = await this.receivingRepo.findById(id);
    if (!note) {
      throw new AppError('Receiving note not found', 404);
    }
    return note;
  }

  async getAllReceivingNotes(filter?: ReceivingNoteFilter): Promise<ReceivingNote[]> {
    return this.receivingRepo.findAll({ filter });
  }

  async cancelReceivingNote(id: string, reason: string): Promise<ReceivingNote> {
    const note = await this.getReceivingNote(id);
    if (note.status === 'cancelled') {
      throw new AppError('Receiving note already cancelled', 400);
    }

    for (const item of note.items) {
      await this.partRepo.updateStock(item.partId, -item.quantity);
    }

    const updated = await this.receivingRepo.cancelReceiving(id, reason);
    if (!updated) {
      throw new AppError('Failed to cancel receiving note', 500);
    }

    logger.info(`Receiving note cancelled: ${updated.receivingNumber}`);
    return updated;
  }

  async createReceivingNoteFromMaintenance(
    maintenanceOrderId: string,
    data: Omit<CreateReceivingNoteDTO, 'orderId' | 'supplierId' | 'items'>
  ): Promise<ReceivingNote> {
    if (!this.maintenanceRepo) {
      throw new AppError('Maintenance repository not initialized', 500);
    }

    const maintenanceOrder = await this.maintenanceRepo.findById(maintenanceOrderId);
    if (!maintenanceOrder) {
      throw new AppError('Maintenance order not found', 404);
    }

    if (!maintenanceOrder.purchaseOrderId) {
      throw new AppError('No purchase order linked to this maintenance order', 400);
    }

    const purchaseOrder = await this.orderRepo.findById(maintenanceOrder.purchaseOrderId);
    if (!purchaseOrder) {
      throw new AppError('Purchase order not found', 404);
    }

    const items = purchaseOrder.items.map(item => ({
      partId: item.partId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      notes: `Received for maintenance order ${maintenanceOrder.orderNumber}`,
    }));

    const receivingNumber = `RN-MNT-${Date.now()}`;

    const receivingNote = await this.createReceivingNote({
      ...data,
      receivingNumber,
      orderId: purchaseOrder.id,
      purchaseOrderId: purchaseOrder.id,
      supplierId: purchaseOrder.supplierId,
      items,
    });

    // ملحوظة: createReceivingNote بقت بتعمل الربط والتحديث الكامل مع الصيانة تلقائيًا بنفسها،
    // فمفيش داعي نكرر تحديث الحالة هنا تاني.

    logger.info(`Receiving note created from maintenance order: ${receivingNote.receivingNumber}`);
    return receivingNote;
  }

  // ============================================================
  // ===== Private Helper Methods =====
  // ============================================================

  private async getDefaultWarehouse(): Promise<string> {
    try {
      const warehouses = await this.warehouseRepo.findAll({
        filter: { isActive: true },
        limit: 1
      });

      if (warehouses && warehouses.length > 0) {
        logger.debug(`Using existing warehouse: ${warehouses[0].id}`);
        return warehouses[0].id;
      }

      logger.warn('No warehouses found, creating default warehouse...');

      const defaultWarehouse = await this.warehouseRepo.create({
        name: 'المخزن الرئيسي',
        code: 'MAIN-WH',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      logger.info(`✅ Default warehouse created: ${defaultWarehouse.id}`);
      return defaultWarehouse.id;
    } catch (error) {
      logger.error('Failed to get or create default warehouse:', error);
      throw new AppError('No warehouses available and failed to create default warehouse. Please create a warehouse first.', 500);
    }
  }

  private async updateOrderItemsReceivedQuantity(
    orderId: string,
    receivedItems: CreateReceivingItemDTO[]
  ): Promise<void> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const updatedItems = order.items.map(item => {
      const receivedItem = receivedItems.find(ri => ri.partId === item.partId);
      if (receivedItem) {
        return {
          ...item,
          receivedQuantity: (item.receivedQuantity || 0) + receivedItem.quantity
        };
      }
      return item;
    });

    await this.orderRepo.update(orderId, { items: updatedItems });
  }

  private async updateOrderStatusAfterReceiving(orderId: string): Promise<void> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    let allReceived = true;
    let anyReceived = false;

    for (const item of order.items) {
      const received = item.receivedQuantity || 0;
      if (received > 0) anyReceived = true;
      if (received < item.quantity) allReceived = false;
    }

    let newStatus: PurchaseOrder['status'] = order.status;
    if (allReceived && anyReceived) {
      newStatus = 'fully_received';
    } else if (anyReceived) {
      newStatus = 'partial_received';
    }

    if (newStatus !== order.status) {
      await this.orderRepo.updateStatus(orderId, newStatus);
      if (newStatus === 'fully_received') {
        await this.orderRepo.update(orderId, {
          actualDeliveryDate: new Date().toISOString()
        });
      }
    }
  }

  // ============================================================
  // ===== ✅ Maintenance Integration (Public) =====
  // ============================================================

  // ✅ FIX: بتاخد warehouseId اختياري (5th arg) دلوقتي عشان تقدر تسحب القطع
  //         تلقائيًا من نفس المخزن اللي استلمت فيه.
  //         ✅ FIX جديد: بمجرد ما آخر قطعة ناقصة تتوفر، الأمر بيتحول
  //         مباشرة لـ 'completed' (مش 'in_progress') من غير ما حد يحتاج
  //         يفتح تاب التعديل ويضغط حفظ. الاستثناء الوحيد المتبقي اللي
  //         محتاج تدخل بشري هو الإلغاء الصريح.
  async updateMaintenanceAfterReceiving(
    maintenanceOrderId: string,
    receivedItems: CreateReceivingItemDTO[],
    receivingNumber: string,
    supplierId?: string,
    warehouseId?: string
  ): Promise<MaintenanceOrder | null> {
    try {
      if (!this.maintenanceRepo) {
        logger.warn('Maintenance repository not initialized, skipping maintenance update');
        return null;
      }

      const maintenanceOrder = await this.maintenanceRepo.findById(maintenanceOrderId);
      if (!maintenanceOrder) {
        logger.warn(`Maintenance order ${maintenanceOrderId} not found`);
        return null;
      }

      const updatedPartsUsed = [...(maintenanceOrder.partsUsed || [])];
      const updatedPartsNeeded = [...(maintenanceOrder.partsNeeded || [])];
      let totalPartsCost = 0;

      // ✅ NEW: هنجمع هنا القطع اللي فعلاً "اتستخدمت" في الصيانة عشان نسحبها
      // من المخزون تلقائيًا بعد كده (net effect = صفر على المخزون العام،
      // لأن القطعة دخلت واتركبت في نفس اللحظة ولسه ما استقرتش في المخزن)
      const consumedForIssue: Array<{ partId: string; quantity: number; unitPrice: number }> = [];

      for (const receivedItem of receivedItems) {
        const neededIndex = updatedPartsNeeded.findIndex(p => p.partId === receivedItem.partId);

        if (neededIndex !== -1) {
          const needed = updatedPartsNeeded[neededIndex];
          const usedQuantity = Math.min(needed.quantity, receivedItem.quantity);
          const remainingQuantity = needed.quantity - usedQuantity;

          let partName = needed.partName || (receivedItem as any).partName || 'قطعة';
          let partCode = needed.partCode || '';
          const unit = needed.unit || 'قطعة';

          if ((!partName || partName === 'قطعة') && this.partRepo) {
            try {
              const part = await this.partRepo.findById(receivedItem.partId);
              if (part) {
                partName = (part as any).name || (part as any).partName || 'قطعة';
                partCode = partCode || (part as any).code || (part as any).partCode || '';
              }
            } catch (e) {
              // تجاهل
            }
          }

          const unitPrice = receivedItem.unitPrice || needed.estimatedPrice || 0;

          updatedPartsUsed.push({
            partId: receivedItem.partId,
            partName,
            partCode,
            quantity: usedQuantity,
            unit,
            price: unitPrice,
            totalPrice: unitPrice * usedQuantity,
            notes: `تم الاستلام ضمن إذن ${receivingNumber} بتاريخ ${new Date().toISOString()}`
          });

          totalPartsCost += unitPrice * usedQuantity;
          if (usedQuantity > 0) {
            consumedForIssue.push({ partId: receivedItem.partId, quantity: usedQuantity, unitPrice });
          }

          if (remainingQuantity > 0) {
            updatedPartsNeeded[neededIndex].quantity = remainingQuantity;
          } else {
            updatedPartsNeeded.splice(neededIndex, 1);
          }

          logger.info(`✅ Part ${partName} received: ${usedQuantity} units at ${unitPrice} EGP`);
        } else {
          let partName = (receivedItem as any).partName || 'قطعة';
          let partCode = '';
          const unit = 'قطعة';

          if (!partName || partName === 'قطعة') {
            try {
              const part = await this.partRepo.findById(receivedItem.partId);
              if (part) {
                partName = (part as any).name || (part as any).partName || 'قطعة';
                partCode = (part as any).code || (part as any).partCode || '';
              }
            } catch (e) {
              // تجاهل
            }
          }

          const unitPrice = receivedItem.unitPrice || 0;

          updatedPartsUsed.push({
            partId: receivedItem.partId,
            partName,
            partCode,
            quantity: receivedItem.quantity,
            unit,
            price: unitPrice,
            totalPrice: unitPrice * receivedItem.quantity,
            notes: `تم الاستلام ضمن إذن ${receivingNumber} بتاريخ ${new Date().toISOString()}`
          });

          totalPartsCost += unitPrice * receivedItem.quantity;
          if (receivedItem.quantity > 0) {
            consumedForIssue.push({ partId: receivedItem.partId, quantity: receivedItem.quantity, unitPrice });
          }
        }
      }

      const laborCost = maintenanceOrder.laborCost || 0;
      const totalCost = laborCost + totalPartsCost;

      // ✅ FIX: كانت بتقف عند 'parts_received' (أو 'in_progress') وتستنى حد
      // يفتح صفحة الصيانة يدوي. دلوقتي بمجرد ما كل القطع تتوفر، الأمر
      // يتحول مباشرة لـ 'completed' تلقائيًا - مفيش أي خطوة بشرية متبقية
      // غير الإلغاء الصريح لو حصل قبل كده.
      let newStatus = maintenanceOrder.status;
      if (updatedPartsNeeded.length === 0) {
        if (maintenanceOrder.status !== 'completed' && maintenanceOrder.status !== 'cancelled') {
          newStatus = 'completed';
        }
      } else {
        newStatus = 'pending_parts';
      }

      const updated = await this.maintenanceRepo.update(maintenanceOrderId, {
        partsUsed: updatedPartsUsed,
        partsNeeded: updatedPartsNeeded,
        partsCost: totalPartsCost,
        totalCost: totalCost,
        status: newStatus,
        receivingNoteId: receivingNumber,
      });

      // ✅ سحب القطع اللي اتستخدمت فعليًا من المخزون تلقائيًا (net-zero)
      // عشان القطعة اللي جت خصيصى لأمر صيانة معين متفضلش "متاحة" في المخزون العام
      // وهي فعليًا مركبة في العربية بالفعل.
      if (consumedForIssue.length > 0) {
        try {
          const whId = warehouseId || await this.getDefaultWarehouse();
          for (const item of consumedForIssue) {
            await this.transactionRepo.create({
              warehouseId: whId,
              partId: item.partId,
              transactionType: 'issue',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              referenceType: 'maintenance_order',
              referenceId: maintenanceOrderId,
              notes: `صرف تلقائي لأمر الصيانة بعد استلام إذن ${receivingNumber}`,
              status: 'completed',
              createdBy: 'system'
            });
            await this.partRepo.updateStock(item.partId, -item.quantity);
          }
          logger.info(`✅ Auto-issued ${consumedForIssue.length} part line(s) to maintenance order ${maintenanceOrderId} (net-zero stock)`);
        } catch (issueError) {
          logger.error('Error auto-issuing received parts to maintenance order:', issueError);
        }
      }

      logger.info(`✅ Maintenance order ${maintenanceOrderId} updated after receiving parts. Status: ${newStatus}, Total cost: ${totalCost}`);
      return updated || null;
    } catch (error) {
      logger.error('Error updating maintenance after receiving:', error);
      return null;
    }
  }

  // ✅ NEW: جلب حالة طلب الشراء المرتبط بأمر الصيانة
  async getMaintenancePurchaseRequestStatus(maintenanceOrderId: string): Promise<{
    requestId: string;
    status: string;
    approvalStatus: string;
    convertedToPO: boolean;
    items: any[];
  } | null> {
    if (!this.maintenanceRepo) {
      throw new AppError('Maintenance repository not initialized', 500);
    }

    const maintenance = await this.maintenanceRepo.findById(maintenanceOrderId);
    if (!maintenance || !maintenance.purchaseRequestId) {
      return null;
    }

    const request = await this.requestRepo.findById(maintenance.purchaseRequestId);
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

  // ✅ NEW: مزامنة أمر الصيانة مع بيانات المشتريات الحالية (طلب/أمر شراء/إذن استلام)
  async syncMaintenanceWithPurchasing(maintenanceOrderId: string): Promise<MaintenanceOrder> {
    if (!this.maintenanceRepo) {
      throw new AppError('Maintenance repository not initialized', 500);
    }

    const maintenance = await this.maintenanceRepo.findById(maintenanceOrderId);
    if (!maintenance) {
      throw new AppError('Maintenance order not found', 404);
    }

    let purchaseRequest = null;
    if (maintenance.purchaseRequestId) {
      purchaseRequest = await this.requestRepo.findById(maintenance.purchaseRequestId);
    }

    let purchaseOrder = null;
    if (maintenance.purchaseOrderId) {
      purchaseOrder = await this.orderRepo.findById(maintenance.purchaseOrderId);
    }

    let receivingNote = null;
    if (maintenance.receivingNoteId) {
      receivingNote = await this.receivingRepo.findById(maintenance.receivingNoteId).catch(() => null);
      if (!receivingNote) {
        receivingNote = await this.receivingRepo.findByReceivingNumber(maintenance.receivingNoteId).catch(() => null);
      }
    }

    let newStatus = maintenance.status;

    if (receivingNote) {
      newStatus = (maintenance.partsNeeded && maintenance.partsNeeded.length > 0) ? 'pending_parts' : 'completed';
    } else if (purchaseOrder) {
      newStatus = 'parts_ordered';
    } else if (purchaseRequest && purchaseRequest.approvalStatus === 'approved') {
      newStatus = 'parts_ordered';
    } else if (purchaseRequest && purchaseRequest.approvalStatus === 'pending') {
      newStatus = 'pending_parts';
    }

    if (newStatus !== maintenance.status) {
      const updated = await this.maintenanceRepo.update(maintenanceOrderId, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      if (!updated) {
        throw new AppError('Failed to sync maintenance order with purchasing', 500);
      }

      logger.info(`Maintenance order ${maintenanceOrderId} synced with purchasing. New status: ${newStatus}`);
      return updated;
    }

    return maintenance;
  }

  // ✅ NEW: جلب أمر الصيانة المرتبط بطلب شراء محدد
  async getMaintenanceByPurchaseRequest(requestId: string): Promise<MaintenanceOrder | null> {
    if (!this.maintenanceRepo) {
      throw new AppError('Maintenance repository not initialized', 500);
    }

    const results = await this.maintenanceRepo.findAll({
      filter: { purchaseRequestId: requestId }
    });

    if (results && results.length > 0) {
      return results[0];
    }

    return null;
  }

  // ✅ NEW: جلب حالة طلب الشراء وتحديث/مزامنة أمر الصيانة المرتبط تلقائياً
  async checkAndSyncPurchaseRequest(requestId: string): Promise<{
    request: PurchaseRequest;
    maintenanceOrder: MaintenanceOrder | null;
    synced: boolean;
  }> {
    const request = await this.getPurchaseRequest(requestId);

    if (!request.maintenanceOrderId || !this.maintenanceRepo) {
      return { request, maintenanceOrder: null, synced: false };
    }

    const maintenanceOrder = await this.maintenanceRepo.findById(request.maintenanceOrderId);
    if (!maintenanceOrder) {
      return { request, maintenanceOrder: null, synced: false };
    }

    const syncedMaintenanceOrder = await this.syncMaintenanceWithPurchasing(request.maintenanceOrderId);

    return {
      request,
      maintenanceOrder: syncedMaintenanceOrder,
      synced: true
    };
  }

  // ============================================================
  // ===== Extended Methods for Frontend Integration =====
  // ============================================================

  async getPurchaseOrdersWithSuppliers(filter?: PurchaseOrderFilter): Promise<PurchaseOrderWithSupplier[]> {
    const orders = await this.orderRepo.findAll({ filter });
    const result: PurchaseOrderWithSupplier[] = [];

    for (const order of orders) {
      const supplier = await this.supplierRepo.findById(order.supplierId);
      if (supplier) {
        result.push({
          ...order,
          supplier: supplier
        });
      }
    }

    return result;
  }

  async getReceivingNoteWithDetails(id: string): Promise<ReceivingNoteWithDetails | null> {
    const note = await this.getReceivingNote(id);
    if (!note) return null;

    const purchaseOrder = await this.orderRepo.findById(note.orderId);
    const supplier = await this.supplierRepo.findById(note.supplierId);
    const warehouse = await this.warehouseRepo.findById(note.warehouseId);

    return {
      ...note,
      purchaseOrder: purchaseOrder || undefined,
      supplier: supplier || undefined,
      warehouse: warehouse || undefined
    };
  }

  async updatePartStock(data: UpdatePartStockDTO): Promise<void> {
    const part = await this.partRepo.findById(data.partId);
    if (!part) {
      throw new AppError(`Part ${data.partId} not found`, 404);
    }

    const currentStock = part.currentStock || 0;
    let newStock = currentStock;

    if (data.transactionType === 'receiving') {
      newStock = currentStock + data.quantity;
    } else if (data.transactionType === 'consumption') {
      newStock = Math.max(0, currentStock - data.quantity);
    } else if (data.transactionType === 'adjustment') {
      newStock = Math.max(0, data.quantity);
    }

    await this.partRepo.updateStock(data.partId, newStock - currentStock);

    logger.info(`Part stock updated: ${part.code} - ${newStock} (${data.transactionType})`);
  }

  async getPurchaseRequestsByApprovalStatus(approvalStatus: string): Promise<PurchaseRequest[]> {
    return this.requestRepo.findByApprovalStatus(approvalStatus);
  }

  async getUnconvertedPurchaseRequests(): Promise<PurchaseRequest[]> {
    return this.requestRepo.findNotConvertedToPO();
  }

  async updateMaintenanceRequestStatus(
    maintenanceOrderId: string,
    requestStatus: string
  ): Promise<void> {
    try {
      if (!this.maintenanceRepo) {
        logger.warn('Maintenance repository not initialized');
        return;
      }

      const maintenance = await this.maintenanceRepo.findById(maintenanceOrderId);
      if (!maintenance) {
        logger.warn(`Maintenance order ${maintenanceOrderId} not found`);
        return;
      }

      let newStatus = maintenance.status;
      const statusMap: Record<string, string> = {
        'pending': 'pending_parts',
        'approved': 'pending_parts',
        'rejected': 'pending_parts',
        'converted': 'parts_ordered'
      };

      if (requestStatus in statusMap) {
        newStatus = statusMap[requestStatus] as typeof maintenance.status;
      }

      if (newStatus !== maintenance.status) {
        await this.maintenanceRepo.update(maintenanceOrderId, {
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
        logger.info(`✅ Maintenance ${maintenanceOrderId} status updated to ${newStatus} (request status: ${requestStatus})`);
      }
    } catch (error) {
      logger.error('Error updating maintenance request status:', error);
    }
  }
}