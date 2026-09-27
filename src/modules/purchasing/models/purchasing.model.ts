// ===== Supplier Model =====
export interface Supplier {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  contactPerson: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  website?: string;
  address: string;
  taxNumber?: string;
  isTaxable?: boolean;                // ✅ جديد: هل المورد خاضع للضريبة
  commercialRegister?: string;
  commercialRegisterExpiry?: string;  // ✅ جديد: تاريخ انتهاء السجل التجاري
  bankAccount?: string;
  bankName?: string;
  iban?: string;
  swiftCode?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  rating?: number;
  isApproved: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
  metadata?: Record<string, any>;
}

export interface CreateSupplierDTO {
  code: string;
  name: string;
  nameAr?: string;
  contactPerson: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  address: string;
  taxNumber?: string;
  isTaxable?: boolean;                // ✅ جديد
  commercialRegister?: string;
  commercialRegisterExpiry?: string;  // ✅ جديد
  notes?: string;
}

export interface UpdateSupplierDTO {
  name?: string;
  nameAr?: string;
  contactPerson?: string;
  phone?: string;
  alternativePhone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  isTaxable?: boolean;                // ✅ جديد
  commercialRegister?: string;
  commercialRegisterExpiry?: string;  // ✅ جديد
  bankAccount?: string;
  bankName?: string;
  isApproved?: boolean;
  isActive?: boolean;
  rating?: number;
  notes?: string;
}

// ===== Purchase Request Model =====
export interface PurchaseRequest {
  id: string;
  requestNumber: string;
  maintenanceOrderId?: string;
  departmentId?: string;
  branchId?: string;
  requesterId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requiredDate: string;
  purpose: string;
  notes?: string;
  attachments?: string[];
  items: PurchaseRequestItem[];
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'converted' | 'partially_ordered' | 'fully_ordered';
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'under_review';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  convertedToPO?: boolean;           // ✅ جديد: هل تم تحويله إلى أمر شراء
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
}

export interface PurchaseRequestItem {
  id?: string;
  partId: string;
  partName?: string;
  partCode?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
  status?: 'pending' | 'ordered' | 'received' | 'cancelled';
}

export interface CreatePurchaseRequestDTO {
  requestNumber: string;
  maintenanceOrderId?: string;
  departmentId?: string;
  requesterId: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  requiredDate: string;
  purpose: string;
  notes?: string;
  items: CreatePurchaseRequestItemDTO[];
}

export interface CreatePurchaseRequestItemDTO {
  partId: string;
  quantity: number;
  unitPrice?: number;
  notes?: string;
}

// ===== Purchase Order Model =====
export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName?: string;

  // ✅ جديد: بيانات الضريبة والربط بالصيانة
  supplierIsTaxable?: boolean;    // هل المورد خاضع للضريبة
  taxRate?: number;               // نسبة الضريبة (14%)
  taxAmount?: number;             // قيمة الضريبة
  subtotal: number;               // إجمالي قبل الضريبة

  maintenanceOrderId?: string;    // ✅ جديد: رابط أمر الصيانة
  purchaseRequestId?: string;     // ✅ جديد: رابط طلب الشراء

  invoiceNumber?: string;
  orderDate: string;
  expectedDeliveryDate: string;
  actualDeliveryDate?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  paymentMethod?: string;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
  items: PurchaseOrderItem[];
  status: 'draft' | 'sent' | 'confirmed' | 'partial_received' | 'fully_received' | 'cancelled';
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
  metadata?: Record<string, any>;
}

export interface PurchaseOrderItem {
  id?: string;
  partId: string;
  partName?: string;
  partCode?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity?: number;      // ✅ جديد: الكمية المستلمة
  notes?: string;
}

export interface CreatePurchaseOrderDTO {
  orderNumber: string;
  supplierId: string;
  supplierName?: string;
  invoiceNumber?: string;
  orderDate: string;
  expectedDeliveryDate: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  discount?: number;
  tax?: number;
  notes?: string;
  items: CreatePurchaseOrderItemDTO[];
  maintenanceOrderId?: string;    // ✅ جديد
  purchaseRequestId?: string;     // ✅ جديد
}

export interface CreatePurchaseOrderItemDTO {
  partId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface UpdatePurchaseOrderDTO {
  supplierId?: string;
  supplierName?: string;
  invoiceNumber?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  discount?: number;
  tax?: number;
  notes?: string;
  status?: 'draft' | 'sent' | 'confirmed' | 'partial_received' | 'fully_received' | 'cancelled';
  items?: CreatePurchaseOrderItemDTO[];
}

// ===== Receiving Note Model =====
export interface ReceivingNote {
  id: string;
  receivingNumber: string;
  orderId: string;
  supplierId: string;
  supplierName?: string;
  invoiceNumber: string;
  invoiceDate: string;
  receivingDate: string;
  warehouseId: string;
  warehouseName?: string;
  receivedBy: string;
  receivedByName?: string;
  notes?: string;
  items: ReceivingItem[];
  status: 'draft' | 'completed' | 'cancelled';
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
  total?: number;                 // ✅ جديد: إجمالي إذن الاستلام
}

export interface ReceivingItem {
  id?: string;
  partId: string;
  partName?: string;
  partCode?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface CreateReceivingNoteDTO {
  receivingNumber: string;
  orderId: string;
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  receivingDate: string;
  warehouseId: string;
  receivedBy: string;
  notes?: string;
  items: CreateReceivingItemDTO[];
  purchaseOrderId?: string;       // ✅ جديد: بديل لـ orderId للتوافق مع Frontend
  total?: number;                 // ✅ جديد: إجمالي إذن الاستلام
  status?: 'draft' | 'completed' | 'cancelled'; // ✅ جديد: حالة إذن الاستلام
}

export interface CreateReceivingItemDTO {
  partId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface UpdateReceivingNoteDTO {
  invoiceNumber?: string;
  invoiceDate?: string;
  receivingDate?: string;
  warehouseId?: string;
  receivedBy?: string;
  notes?: string;
  items?: CreateReceivingItemDTO[];
  status?: 'draft' | 'completed' | 'cancelled';
}

// ===== Purchase Request with Maintenance Order Details =====
export interface PurchaseRequestWithMaintenance extends PurchaseRequest {
  maintenanceOrder?: {
    orderNumber: string;
    vehicleId: string;
    vehiclePlate?: string;
    problemDescription: string;
    status: string;
  };
}

// ===== Receiving Note with Purchase Order Details =====
export interface ReceivingNoteWithOrder extends ReceivingNote {
  purchaseOrder?: {
    orderNumber: string;
    supplierName: string;
    total: number;
  };
}

// ============================================================
// ✅ NEW: DTO for creating an order from an approved request
// ============================================================
export interface CreateOrderFromRequestDTO {
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate: string;
}

// ============================================================
// ✅ NEW: DTO for receiving a purchase order (inventory update)
// ============================================================
export interface ReceivePurchaseOrderDTO {
  items: ReceiveOrderItemDTO[];
  notes?: string;
  receivingDate?: string;
  warehouseId?: string;
  receivedBy?: string;
}

export interface ReceiveOrderItemDTO {
  partId: string;
  quantity: number;
  unitPrice: number;
  partName?: string;
}

// ============================================================
// ✅ NEW: Response DTO for commercial register expiry check
// ============================================================
export interface CommercialRegisterExpiryResult {
  isExpired: boolean;
  expiryDate?: string;
  daysRemaining?: number;
}

// ============================================================
// ✅ NEW: Supplier Statistics Response
// ============================================================
export interface SupplierStats {
  total: number;
  active: number;
  inactive: number;
  taxable: number;
  nonTaxable: number;
  expiredCommercialRegister: number;
  averageRating: number;
}

// ============================================================
// ✅ NEW: Purchase Order with Supplier Details
// ============================================================
export interface PurchaseOrderWithSupplier extends PurchaseOrder {
  supplier: Supplier;
}

// ============================================================
// ✅ NEW: Receiving Note with Full Details
// ============================================================
export interface ReceivingNoteWithDetails extends ReceivingNote {
  purchaseOrder?: PurchaseOrder;
  supplier?: Supplier;
  warehouse?: any;
}

// ============================================================
// ✅ NEW: Update Part Stock DTO (for inventory integration)
// ============================================================
export interface UpdatePartStockDTO {
  partId: string;
  quantity: number; // positive for receiving, negative for consumption
  transactionType: 'receiving' | 'consumption' | 'adjustment';
  reference?: string;
  notes?: string;
}

// ============================================================
// ✅ NEW: Purchase Request Filter Options
// ============================================================
export interface PurchaseRequestFilter {
  status?: PurchaseRequest['status'];
  approvalStatus?: PurchaseRequest['approvalStatus'];
  maintenanceOrderId?: string;
  requesterId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// ============================================================
// ✅ NEW: Purchase Order Filter Options
// ============================================================
export interface PurchaseOrderFilter {
  status?: PurchaseOrder['status'];
  supplierId?: string;
  maintenanceOrderId?: string;
  purchaseRequestId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// ============================================================
// ✅ NEW: Receiving Note Filter Options
// ============================================================
export interface ReceivingNoteFilter {
  status?: ReceivingNote['status'];
  orderId?: string;
  supplierId?: string;
  maintenanceOrderId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}