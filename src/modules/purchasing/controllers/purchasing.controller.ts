import { Request, Response } from 'express';
import { PurchasingService } from '../services/purchasing.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import {
  CreateSupplierDTO,
  CreatePurchaseRequestDTO,
  CreatePurchaseOrderDTO,
  CreateReceivingNoteDTO
} from '../models/purchasing.model';

export class PurchasingController {
  constructor(private purchasingService: PurchasingService) {}

  // ============================================================
  // ===== Supplier Controllers =====
  // ============================================================
  createSupplier = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateSupplierDTO = req.body;
    const supplier = await this.purchasingService.createSupplier(data);
    res.status(201).json({ success: true, message: 'Supplier created', data: supplier });
  });

  getSupplier = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const supplier = await this.purchasingService.getSupplier(id);
    res.json({ success: true, data: supplier });
  });

  getAllSuppliers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type, isActive } = req.query;
    let filter: any = {};
    if (type) filter.supplierType = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    const suppliers = await this.purchasingService.getAllSuppliers(filter);
    res.json({ success: true, data: suppliers, count: suppliers.length });
  });

  updateSupplier = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body;
    const supplier = await this.purchasingService.updateSupplier(id, data);
    res.json({ success: true, message: 'Supplier updated', data: supplier });
  });

  deleteSupplier = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.purchasingService.deleteSupplier(id);
    res.json({ success: true, message: 'Supplier deleted' });
  });

  // ✅ جديد: الحصول على الموردين النشطين
  getActiveSuppliers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const suppliers = await this.purchasingService.getActiveSuppliers();
    res.json({ success: true, data: suppliers, count: suppliers.length });
  });

  // ✅ جديد: الحصول على الموردين الخاضعين للضريبة
  getTaxableSuppliers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const suppliers = await this.purchasingService.getTaxableSuppliers();
    res.json({ success: true, data: suppliers, count: suppliers.length });
  });

  // ✅ جديد: الحصول على الموردين حسب النوع
  getSuppliersByType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type } = req.params;
    const suppliers = await this.purchasingService.getSuppliersByType(type);
    res.json({ success: true, data: suppliers, count: suppliers.length });
  });

  // ✅ جديد: الحصول على الموردين منتهي السجل التجاري
  getExpiredCommercialRegisterSuppliers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const suppliers = await this.purchasingService.getExpiredCommercialRegisterSuppliers();
    res.json({ success: true, data: suppliers, count: suppliers.length });
  });

  // ✅ جديد: التحقق من انتهاء السجل التجاري لمورد
  checkCommercialRegisterExpiry = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.purchasingService.checkCommercialRegisterExpiry(id);
    res.json({ success: true, data: result });
  });

  // ✅ جديد: تحديث تقييم المورد
  updateSupplierRating = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { rating } = req.body;
    if (rating === undefined || rating === null) {
      res.status(400).json({ success: false, message: 'rating is required' });
      return;
    }
    const supplier = await this.purchasingService.updateSupplierRating(id, rating);
    res.json({ success: true, message: 'Supplier rating updated', data: supplier });
  });

  // ✅ جديد: إحصائيات الموردين
  getSupplierStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.purchasingService.getSupplierStats();
    res.json({ success: true, data: stats });
  });

  // ============================================================
  // ===== Purchase Request Controllers =====
  // ============================================================
  createPurchaseRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreatePurchaseRequestDTO = req.body;
    const request = await this.purchasingService.createPurchaseRequest(data);
    res.status(201).json({ success: true, message: 'Purchase request created', data: request });
  });

  getPurchaseRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const request = await this.purchasingService.getPurchaseRequest(id);
    res.json({ success: true, data: request });
  });

  getAllPurchaseRequests = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, maintenanceOrderId } = req.query;
    let filter: any = {};
    if (status) filter.status = status;
    if (maintenanceOrderId) filter.maintenanceOrderId = maintenanceOrderId;
    const requests = await this.purchasingService.getAllPurchaseRequests(filter);
    res.json({ success: true, data: requests, count: requests.length });
  });

  // ✅ جديد: تحديث طلب شراء
  updatePurchaseRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body;
    const request = await this.purchasingService.updatePurchaseRequest(id, data);
    res.json({ success: true, message: 'Purchase request updated', data: request });
  });

  // ✅ جديد: حذف طلب شراء
  deletePurchaseRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.purchasingService.deletePurchaseRequest(id);
    res.json({ success: true, message: 'Purchase request deleted' });
  });

  approvePurchaseRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    const request = await this.purchasingService.approvePurchaseRequest(id, userId);
    res.json({ success: true, message: 'Purchase request approved', data: request });
  });

  rejectPurchaseRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, message: 'reason is required' });
      return;
    }
    const request = await this.purchasingService.rejectPurchaseRequest(id, reason);
    res.json({ success: true, message: 'Purchase request rejected', data: request });
  });

  // ✅ جديد: الحصول على طلبات الشراء حسب أمر الصيانة
  getPurchaseRequestsByMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { maintenanceOrderId } = req.params;
    const requests = await this.purchasingService.getPurchaseRequestsByMaintenance(maintenanceOrderId);
    res.json({ success: true, data: requests, count: requests.length });
  });

  // ✅ جديد: الحصول على طلب شراء مع بيانات الصيانة
  getPurchaseRequestWithMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const request = await this.purchasingService.getPurchaseRequestWithMaintenance(id);
    res.json({ success: true, data: request });
  });

  // ============================================================
  // ===== Purchase Order Controllers =====
  // ============================================================
  createPurchaseOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreatePurchaseOrderDTO = req.body;
    const order = await this.purchasingService.createPurchaseOrder(data);
    res.status(201).json({ success: true, message: 'Purchase order created', data: order });
  });

  getPurchaseOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const order = await this.purchasingService.getPurchaseOrder(id);
    res.json({ success: true, data: order });
  });

  getAllPurchaseOrders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, supplierId, maintenanceOrderId } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (supplierId) filter.supplierId = supplierId;
    if (maintenanceOrderId) filter.maintenanceOrderId = maintenanceOrderId;
    const orders = await this.purchasingService.getAllPurchaseOrders(filter);
    res.json({ success: true, data: orders, count: orders.length });
  });

  updatePurchaseOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body;
    const order = await this.purchasingService.updatePurchaseOrder(id, data);
    res.json({ success: true, message: 'Purchase order updated', data: order });
  });

  deletePurchaseOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.purchasingService.deletePurchaseOrder(id);
    res.json({ success: true, message: 'Purchase order deleted' });
  });

  // ✅ جديد: تأكيد أمر الشراء
  confirmPurchaseOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const order = await this.purchasingService.confirmPurchaseOrder(id);
    res.json({ success: true, message: 'Purchase order confirmed', data: order });
  });

  // ✅ جديد: إلغاء أمر الشراء
  cancelPurchaseOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, message: 'reason is required' });
      return;
    }
    const order = await this.purchasingService.cancelPurchaseOrder(id, reason);
    res.json({ success: true, message: 'Purchase order cancelled', data: order });
  });

  // ✅ جديد: الحصول على أوامر الشراء حسب أمر الصيانة
  getPurchaseOrdersByMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { maintenanceOrderId } = req.params;
    const orders = await this.purchasingService.getPurchaseOrdersByMaintenance(maintenanceOrderId);
    res.json({ success: true, data: orders, count: orders.length });
  });

  // ✅✅✅ جديد: إنشاء أمر شراء من طلب شراء معتمد
  createOrderFromRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { supplierId, orderDate, expectedDeliveryDate } = req.body;

    // التحقق من الحقول المطلوبة
    if (!supplierId) {
      res.status(400).json({ success: false, message: 'supplierId is required' });
      return;
    }
    if (!orderDate) {
      res.status(400).json({ success: false, message: 'orderDate is required' });
      return;
    }
    if (!expectedDeliveryDate) {
      res.status(400).json({ success: false, message: 'expectedDeliveryDate is required' });
      return;
    }

    const order = await this.purchasingService.createOrderFromRequest(id, {
      supplierId,
      orderDate,
      expectedDeliveryDate
    });

    res.status(201).json({
      success: true,
      message: 'Purchase order created from request',
      data: order
    });
  });

  // ============================================================
  // ===== Receiving Note Controllers =====
  // ============================================================
  createReceivingNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateReceivingNoteDTO = req.body;
    const note = await this.purchasingService.createReceivingNote(data);
    res.status(201).json({ success: true, message: 'Receiving note created', data: note });
  });

  getReceivingNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const note = await this.purchasingService.getReceivingNote(id);
    res.json({ success: true, data: note });
  });

  getAllReceivingNotes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { orderId, supplierId, maintenanceOrderId } = req.query;
    const filter: any = {};
    if (orderId) filter.orderId = orderId;
    if (supplierId) filter.supplierId = supplierId;
    if (maintenanceOrderId) filter.maintenanceOrderId = maintenanceOrderId;
    const notes = await this.purchasingService.getAllReceivingNotes(filter);
    res.json({ success: true, data: notes, count: notes.length });
  });

  // ✅ جديد: تحديث إذن استلام
  updateReceivingNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body;
    const note = await this.purchasingService.updateReceivingNote(id, data);
    res.json({ success: true, message: 'Receiving note updated', data: note });
  });

  // ✅ جديد: إكمال إذن استلام
  completeReceivingNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const note = await this.purchasingService.completeReceivingNote(id);
    res.json({ success: true, message: 'Receiving note completed', data: note });
  });

  // ✅ جديد: حذف إذن استلام
  deleteReceivingNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.purchasingService.deleteReceivingNote(id);
    res.json({ success: true, message: 'Receiving note deleted' });
  });

  cancelReceivingNote = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, message: 'reason is required' });
      return;
    }
    const note = await this.purchasingService.cancelReceivingNote(id, reason);
    res.json({ success: true, message: 'Receiving note cancelled', data: note });
  });

  // ✅ جديد: الحصول على إذن استلام حسب أمر الصيانة
  getReceivingNotesByOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { orderId } = req.params;
    const notes = await this.purchasingService.getReceivingNotesByOrder(orderId);
    res.json({ success: true, data: notes, count: notes.length });
  });

  // ============================================================
  // ===== Maintenance Integration Controllers =====
  // ============================================================

  // ✅ جديد: إنشاء طلب شراء من أمر الصيانة
  createPurchaseRequestFromMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { maintenanceOrderId } = req.params;
    const userId = req.user?.id || 'system';
    const request = await this.purchasingService.createPurchaseRequestFromMaintenance(maintenanceOrderId, userId);
    res.status(201).json({ success: true, message: 'Purchase request created from maintenance', data: request });
  });

  // ✅ جديد: إنشاء أمر شراء من أمر الصيانة
  createPurchaseOrderFromMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { maintenanceOrderId } = req.params;
    const data = req.body;
    const order = await this.purchasingService.createPurchaseOrderFromMaintenance(maintenanceOrderId, data);
    res.status(201).json({ success: true, message: 'Purchase order created from maintenance', data: order });
  });

  // ✅ جديد: إنشاء إذن استلام من أمر الصيانة
  createReceivingNoteFromMaintenance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { maintenanceOrderId } = req.params;
    const data = req.body;
    const note = await this.purchasingService.createReceivingNoteFromMaintenance(maintenanceOrderId, data);
    res.status(201).json({ success: true, message: 'Receiving note created from maintenance', data: note });
  });

  // ============================================================
  // ===== ✅ NEW: Maintenance Status Sync Controllers =====
  // ============================================================

  // ✅✅✅ NEW: تحديث حالة أمر الصيانة بناءً على حالة طلب الشراء
  updateMaintenanceRequestStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { maintenanceOrderId } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ success: false, message: 'status is required' });
      return;
    }

    await this.purchasingService.updateMaintenanceRequestStatus(maintenanceOrderId, status);
    res.json({
      success: true,
      message: `Maintenance order ${maintenanceOrderId} status updated to ${status}`
    });
  });

  // ✅✅✅ NEW: جلب حالة طلب الشراء المرتبط بأمر الصيانة
  getMaintenancePurchaseRequestStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { maintenanceOrderId } = req.params;

    const result = await this.purchasingService.getMaintenancePurchaseRequestStatus(maintenanceOrderId);

    if (!result) {
      res.json({
        success: true,
        data: null,
        message: 'No purchase request linked to this maintenance order'
      });
      return;
    }

    res.json({ success: true, data: result });
  });

  // ✅✅✅ NEW: مزامنة أمر الصيانة مع بيانات المشتريات
  syncMaintenanceWithPurchasing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { maintenanceOrderId } = req.params;

    const result = await this.purchasingService.syncMaintenanceWithPurchasing(maintenanceOrderId);

    res.json({
      success: true,
      message: `Maintenance order ${maintenanceOrderId} synced with purchasing`,
      data: result
    });
  });

  // ✅✅✅ NEW: جلب بيانات أمر الصيانة المرتبط بطلب شراء
  getMaintenanceByPurchaseRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { requestId } = req.params;

    const result = await this.purchasingService.getMaintenanceByPurchaseRequest(requestId);

    if (!result) {
      res.json({
        success: true,
        data: null,
        message: 'No maintenance order linked to this purchase request'
      });
      return;
    }

    res.json({ success: true, data: result });
  });

  // ✅✅✅ NEW: تحديث أمر الصيانة عند استلام قطع الغيار
  updateMaintenanceAfterReceiving = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { maintenanceOrderId } = req.params;
    const { receivedItems, receivingNumber, supplierId } = req.body;

    if (!receivedItems || !Array.isArray(receivedItems) || receivedItems.length === 0) {
      res.status(400).json({ success: false, message: 'receivedItems is required and must be a non-empty array' });
      return;
    }

    if (!receivingNumber) {
      res.status(400).json({ success: false, message: 'receivingNumber is required' });
      return;
    }

    const result = await this.purchasingService.updateMaintenanceAfterReceiving(
      maintenanceOrderId,
      receivedItems,
      receivingNumber,
      supplierId
    );

    res.json({
      success: true,
      message: `Maintenance order ${maintenanceOrderId} updated with received parts`,
      data: result
    });
  });

  // ✅✅✅ NEW: جلب حالة طلب الشراء وتحديث الصيانة تلقائياً
  checkAndSyncPurchaseRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { requestId } = req.params;

    const result = await this.purchasingService.checkAndSyncPurchaseRequest(requestId);

    res.json({
      success: true,
      message: `Purchase request ${requestId} checked and synced`,
      data: result
    });
  });
}