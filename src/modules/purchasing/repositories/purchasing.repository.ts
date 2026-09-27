import BaseRepository from '../../../core/repositories/base.repository';
import { Supplier, PurchaseRequest, PurchaseOrder, ReceivingNote } from '../models/purchasing.model';

// ===== Supplier Repository =====
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

  // ✅ جديد: الموردين الخاضعين للضريبة
  async findTaxable(): Promise<Supplier[]> {
    return this.findAll({ filter: { isTaxable: true } });
  }

  // ✅ جديد: الموردين حسب النوع (يعتمد على حقل type لو موجود، وإلا يرجع الكل)
  async findByType(type: string): Promise<Supplier[]> {
    return this.findAll({ filter: { type } });
  }

  // ✅ جديد: الموردين اللي انتهى سجلهم التجاري
  async findExpiredCommercialRegister(): Promise<Supplier[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.findAll({
      filter: {
        commercialRegisterExpiry: { $lte: today }
      }
    });
  }

  // ✅ جديد: تحديث تقييم المورد
  async updateRating(id: string, rating: number): Promise<Supplier | null> {
    return this.update(id, { rating });
  }

  // ✅✅✅ جديد: البحث عن الموردين حسب الاسم أو الكود (للبحث)
  async searchSuppliers(searchTerm: string): Promise<Supplier[]> {
    return this.findAll({
      filter: {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { code: { $regex: searchTerm, $options: 'i' } },
          { contactPerson: { $regex: searchTerm, $options: 'i' } }
        ]
      }
    });
  }

  // ✅✅✅ جديد: الحصول على الموردين مع التقييمات
  async findWithRatings(): Promise<Supplier[]> {
    return this.findAll({
      filter: { rating: { $ne: null } },
      sort: { rating: 'desc' }
    });
  }

  // ✅✅✅ جديد: التحقق من صحة السجل التجاري
  async checkCommercialRegisterValidity(id: string): Promise<{ isValid: boolean; expiryDate?: string }> {
    const supplier = await this.findById(id);
    if (!supplier || !supplier.commercialRegisterExpiry) {
      return { isValid: false };
    }
    const today = new Date().toISOString().split('T')[0];
    const isValid = supplier.commercialRegisterExpiry > today;
    return { isValid, expiryDate: supplier.commercialRegisterExpiry };
  }
}

// ===== Purchase Request Repository =====
export class PurchaseRequestRepository extends BaseRepository<PurchaseRequest> {
  constructor() {
    super('purchase_requests');
  }

  async findByRequestNumber(requestNumber: string): Promise<PurchaseRequest | null> {
    return this.findOne({ requestNumber });
  }

  async findByStatus(status: string): Promise<PurchaseRequest[]> {
    return this.findAll({ filter: { status } });
  }

  async findByRequester(requesterId: string): Promise<PurchaseRequest[]> {
    return this.findAll({ filter: { requesterId } });
  }

  async updateStatus(id: string, status: PurchaseRequest['status']): Promise<PurchaseRequest | null> {
    return this.update(id, { status });
  }

  async approveRequest(id: string, approvedBy: string): Promise<PurchaseRequest | null> {
    return this.update(id, {
      approvalStatus: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString()
    });
  }

  async rejectRequest(id: string, reason: string): Promise<PurchaseRequest | null> {
    return this.update(id, {
      approvalStatus: 'rejected',
      rejectionReason: reason,
      rejectedAt: new Date().toISOString()
    });
  }

  // ✅✅✅ جديد: البحث عن طلبات الشراء حسب حالة الاعتماد
  async findByApprovalStatus(approvalStatus: string): Promise<PurchaseRequest[]> {
    return this.findAll({ filter: { approvalStatus } });
  }

  // ✅✅✅ جديد: البحث عن طلبات الشراء المحولة لأوامر شراء
  async findConvertedToPO(): Promise<PurchaseRequest[]> {
    return this.findAll({ filter: { convertedToPO: true } });
  }

  // ✅✅✅ جديد: البحث عن طلبات الشراء غير المحولة لأوامر شراء
  async findNotConvertedToPO(): Promise<PurchaseRequest[]> {
    return this.findAll({ filter: { convertedToPO: { $ne: true } } });
  }

  // ✅✅✅ جديد: تحديث حالة التحويل لأمر شراء
  async markAsConverted(id: string): Promise<PurchaseRequest | null> {
    return this.update(id, {
      convertedToPO: true,
      status: 'converted'
    });
  }

  // ✅✅✅ جديد: البحث عن طلبات الشراء حسب نطاق التاريخ
  async findByDateRange(dateFrom: string, dateTo: string): Promise<PurchaseRequest[]> {
    return this.findAll({
      filter: {
        createdAt: {
          $gte: dateFrom,
          $lte: dateTo
        }
      }
    });
  }

  // ✅✅✅ جديد: البحث عن طلبات الشراء حسب الأولوية
  async findByPriority(priority: 'low' | 'medium' | 'high' | 'urgent'): Promise<PurchaseRequest[]> {
    return this.findAll({ filter: { priority } });
  }
}

// ===== Purchase Order Repository =====
export class PurchaseOrderRepository extends BaseRepository<PurchaseOrder> {
  constructor() {
    super('purchase_orders');
  }

  async findByOrderNumber(orderNumber: string): Promise<PurchaseOrder | null> {
    return this.findOne({ orderNumber });
  }

  async findBySupplier(supplierId: string): Promise<PurchaseOrder[]> {
    return this.findAll({ filter: { supplierId } });
  }

  async findByStatus(status: string): Promise<PurchaseOrder[]> {
    return this.findAll({ filter: { status } });
  }

  async updateStatus(id: string, status: PurchaseOrder['status']): Promise<PurchaseOrder | null> {
    return this.update(id, { status });
  }

  async receiveOrder(id: string, actualDeliveryDate: string): Promise<PurchaseOrder | null> {
    return this.update(id, {
      status: 'fully_received',
      actualDeliveryDate
    });
  }

  // ✅✅✅ جديد: البحث عن أوامر الشراء حسب طلب الشراء
  async findByPurchaseRequest(purchaseRequestId: string): Promise<PurchaseOrder[]> {
    return this.findAll({ filter: { purchaseRequestId } });
  }

  // ✅✅✅ جديد: البحث عن أوامر الشراء حسب نطاق التاريخ
  async findByDateRange(dateFrom: string, dateTo: string): Promise<PurchaseOrder[]> {
    return this.findAll({
      filter: {
        orderDate: {
          $gte: dateFrom,
          $lte: dateTo
        }
      }
    });
  }

  // ✅✅✅ جديد: تحديث الكمية المستلمة لبند في أمر الشراء
  async updateItemReceivedQuantity(
    orderId: string,
    partId: string,
    receivedQuantity: number
  ): Promise<PurchaseOrder | null> {
    const order = await this.findById(orderId);
    if (!order) return null;

    const updatedItems = order.items.map(item => {
      if (item.partId === partId) {
        return {
          ...item,
          receivedQuantity: (item.receivedQuantity || 0) + receivedQuantity
        };
      }
      return item;
    });

    // Check if all items are fully received
    const allFullyReceived = updatedItems.every(
      item => (item.receivedQuantity || 0) >= item.quantity
    );
    const someReceived = updatedItems.some(
      item => (item.receivedQuantity || 0) > 0
    );

    let newStatus: PurchaseOrder['status'] = order.status;
    if (allFullyReceived && someReceived) {
      newStatus = 'fully_received';
    } else if (someReceived) {
      newStatus = 'partial_received';
    }

    return this.update(orderId, {
      items: updatedItems,
      status: newStatus,
      actualDeliveryDate: allFullyReceived ? new Date().toISOString() : undefined
    });
  }

  // ✅✅✅ جديد: الحصول على إحصائيات أوامر الشراء
  async getOrderStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalAmount: number;
    averageAmount: number;
  }> {
    const orders = await this.findAll();
    const byStatus: Record<string, number> = {};
    let totalAmount = 0;

    for (const order of orders) {
      byStatus[order.status] = (byStatus[order.status] || 0) + 1;
      totalAmount += order.total || 0;
    }

    return {
      total: orders.length,
      byStatus,
      totalAmount,
      averageAmount: orders.length > 0 ? totalAmount / orders.length : 0
    };
  }
}

// ===== Receiving Note Repository =====
export class ReceivingNoteRepository extends BaseRepository<ReceivingNote> {
  constructor() {
    super('receiving_notes');
  }

  async findByReceivingNumber(receivingNumber: string): Promise<ReceivingNote | null> {
    return this.findOne({ receivingNumber });
  }

  async findByOrder(orderId: string): Promise<ReceivingNote[]> {
    return this.findAll({ filter: { orderId } });
  }

  async findBySupplier(supplierId: string): Promise<ReceivingNote[]> {
    return this.findAll({ filter: { supplierId } });
  }

  async completeReceiving(id: string): Promise<ReceivingNote | null> {
    return this.update(id, { status: 'completed' });
  }

  async cancelReceiving(id: string, reason: string): Promise<ReceivingNote | null> {
    return this.update(id, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: new Date().toISOString()
    });
  }

  // ✅✅✅ جديد: البحث عن إذون الاستلام حسب نطاق التاريخ
  async findByDateRange(dateFrom: string, dateTo: string): Promise<ReceivingNote[]> {
    return this.findAll({
      filter: {
        receivingDate: {
          $gte: dateFrom,
          $lte: dateTo
        }
      }
    });
  }

  // ✅✅✅ جديد: البحث عن إذون الاستلام حسب المخزن
  async findByWarehouse(warehouseId: string): Promise<ReceivingNote[]> {
    return this.findAll({ filter: { warehouseId } });
  }

  // ✅✅✅ جديد: الحصول على إحصائيات إذون الاستلام
  async getReceivingStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalItems: number;
    totalAmount: number;
  }> {
    const notes = await this.findAll();
    const byStatus: Record<string, number> = {};
    let totalItems = 0;
    let totalAmount = 0;

    for (const note of notes) {
      byStatus[note.status] = (byStatus[note.status] || 0) + 1;
      totalItems += note.items?.length || 0;
      // حساب الإجمالي من البنود
      if (note.items) {
        for (const item of note.items) {
          totalAmount += (item.totalPrice || 0);
        }
      }
    }

    return {
      total: notes.length,
      byStatus,
      totalItems,
      totalAmount
    };
  }

  // ✅✅✅ جديد: البحث عن إذون الاستلام حسب المستلم
  async findByReceiver(receivedBy: string): Promise<ReceivingNote[]> {
    return this.findAll({ filter: { receivedBy } });
  }
}

// ============================================================
// ✅ NEW: Extended Repository with combined queries
// ============================================================

// ===== Combined Repository for complex queries =====
export class PurchasingQueryRepository {
  constructor(
    private supplierRepo: SupplierRepository,
    private requestRepo: PurchaseRequestRepository,
    private orderRepo: PurchaseOrderRepository,
    private receivingRepo: ReceivingNoteRepository
  ) {}

  // ✅ جديد: الحصول على أوامر الشراء مع تفاصيل الموردين
  async getOrdersWithSupplierDetails(filter?: any): Promise<any[]> {
    const orders = await this.orderRepo.findAll({ filter });
    const suppliers = await this.supplierRepo.findAll();
    const supplierMap = new Map(suppliers.map(s => [s.id, s]));

    return orders.map(order => ({
      ...order,
      supplier: supplierMap.get(order.supplierId) || null,
      supplierName: supplierMap.get(order.supplierId)?.name || order.supplierName
    }));
  }

  // ✅ جديد: الحصول على طلبات الشراء مع تفاصيل الطلب
  async getRequestsWithDetails(filter?: any): Promise<any[]> {
    const requests = await this.requestRepo.findAll({ filter });
    // يمكن إضافة تفاصيل إضافية هنا حسب الحاجة
    return requests;
  }

  // ✅ جديد: البحث المتقدم في أوامر الشراء
  async advancedOrderSearch(searchParams: {
    orderNumber?: string;
    supplierId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    minAmount?: number;
    maxAmount?: number;
  }): Promise<PurchaseOrder[]> {
    const filter: any = {};

    if (searchParams.orderNumber) {
      filter.orderNumber = { $regex: searchParams.orderNumber, $options: 'i' };
    }
    if (searchParams.supplierId) {
      filter.supplierId = searchParams.supplierId;
    }
    if (searchParams.status) {
      filter.status = searchParams.status;
    }
    if (searchParams.dateFrom && searchParams.dateTo) {
      filter.orderDate = {
        $gte: searchParams.dateFrom,
        $lte: searchParams.dateTo
      };
    }
    if (searchParams.minAmount !== undefined) {
      filter.total = { $gte: searchParams.minAmount };
    }
    if (searchParams.maxAmount !== undefined) {
      filter.total = { ...filter.total, $lte: searchParams.maxAmount };
    }

    return this.orderRepo.findAll({ filter });
  }

  // ✅ جديد: الحصول على تقرير كامل للمشتريات
  async getFullPurchasingReport(
    dateFrom?: string,
    dateTo?: string
  ): Promise<{
    orders: PurchaseOrder[];
    totalOrders: number;
    totalAmount: number;
    averageOrderValue: number;
    topSuppliers: Array<{ supplierId: string; supplierName: string; totalAmount: number; orderCount: number }>;
    statusDistribution: Record<string, number>;
  }> {
    const filter: any = {};
    if (dateFrom && dateTo) {
      filter.orderDate = {
        $gte: dateFrom,
        $lte: dateTo
      };
    }

    const orders = await this.orderRepo.findAll({ filter });
    const suppliers = await this.supplierRepo.findAll();
    const supplierMap = new Map(suppliers.map(s => [s.id, s]));

    let totalAmount = 0;
    const supplierTotals: Record<string, { total: number; count: number }> = {};
    const statusDistribution: Record<string, number> = {};

    for (const order of orders) {
      totalAmount += order.total || 0;
      statusDistribution[order.status] = (statusDistribution[order.status] || 0) + 1;

      if (!supplierTotals[order.supplierId]) {
        supplierTotals[order.supplierId] = { total: 0, count: 0 };
      }
      supplierTotals[order.supplierId].total += order.total || 0;
      supplierTotals[order.supplierId].count += 1;
    }

    // ترتيب الموردين حسب الإجمالي
    const topSuppliers = Object.entries(supplierTotals)
      .map(([supplierId, data]) => ({
        supplierId,
        supplierName: supplierMap.get(supplierId)?.name || 'غير معروف',
        totalAmount: data.total,
        orderCount: data.count
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    return {
      orders,
      totalOrders: orders.length,
      totalAmount,
      averageOrderValue: orders.length > 0 ? totalAmount / orders.length : 0,
      topSuppliers,
      statusDistribution
    };
  }
}