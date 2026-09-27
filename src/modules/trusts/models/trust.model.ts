// C:\Users\Amir\fleet-erp\backend\src\modules\trusts\models\trust.model.ts

export interface Trust {
  id: string;
  trustNumber: string;                // رقم العهد (مولد تلقائي)
  trusteeId: string;                  // الشخص المعهود إليه
  trusteeType: 'driver' | 'technician' | 'storekeeper' | 'admin' | 'other';
  trusteeName?: string;               // اسم المستلم (للتوثيق)
  trusteeDepartment?: string;         // إدارة المستلم
  
  items: TrustItem[];                 // قائمة الأغراض
  
  issueDate: string;                  // تاريخ الصرف
  expectedReturnDate?: string;        // تاريخ الإرجاع المتوقع
  returnDate?: string;                // تاريخ الإرجاع الفعلي
  
  status: 'active' | 'returned' | 'partial' | 'overdue' | 'cancelled';
  notes?: string;
  
  // المراجع
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  returnedBy?: string;                // من استلم العهدة عند الإرجاع
  returnedTo?: string;                // إلى من تم الإرجاع
  
  attachments?: string[];

  // ===== سجل نقل العهدة =====
  transferHistory?: TrustTransfer[];  // تاريخ كل عمليات نقل العهدة من موظف لآخر

  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
  metadata?: Record<string, any>;
}

export interface TrustItem {
  id?: string;
  itemName: string;
  itemCode?: string;
  quantity: number;
  unit: 'piece' | 'set' | 'box' | 'meter' | 'kg' | 'liter';
  description?: string;
  serialNumber?: string;              // رقم مسلسل للأجهزة
  condition?: 'new' | 'good' | 'used' | 'damaged';  // حالة القطعة عند الصرف
  returnedQuantity?: number;          // الكمية المرتجعة
  returnedCondition?: 'new' | 'good' | 'used' | 'damaged'; // حالة القطعة عند الإرجاع
  notes?: string;
}

// ===== نقل العهدة من موظف لآخر =====
export interface TrustTransfer {
  id?: string;
  fromTrusteeId: string;              // صاحب العهدة قبل النقل
  fromTrusteeName?: string;
  toTrusteeId: string;                // صاحب العهدة الجديد
  toTrusteeName?: string;
  toTrusteeType?: 'driver' | 'technician' | 'storekeeper' | 'admin' | 'other';
  transferDate: string;               // تاريخ نقل العهدة
  notes?: string;
  transferredBy?: string;             // مين اللي سجل عملية النقل
  createdAt?: string;
}

export interface CreateTrustDTO {
  trusteeId: string;
  trusteeType: 'driver' | 'technician' | 'storekeeper' | 'admin' | 'other';
  trusteeName?: string;
  trusteeDepartment?: string;
  items: CreateTrustItemDTO[];
  issueDate: string;
  expectedReturnDate?: string;
  notes?: string;
}

export interface CreateTrustItemDTO {
  itemName: string;
  itemCode?: string;
  quantity: number;
  unit: 'piece' | 'set' | 'box' | 'meter' | 'kg' | 'liter';
  description?: string;
  serialNumber?: string;
  condition?: 'new' | 'good' | 'used' | 'damaged';
  notes?: string;
}

export interface UpdateTrustDTO {
  trusteeId?: string;
  trusteeType?: 'driver' | 'technician' | 'storekeeper' | 'admin' | 'other';
  trusteeName?: string;
  trusteeDepartment?: string;
  items?: CreateTrustItemDTO[];
  expectedReturnDate?: string;
  returnDate?: string;
  status?: 'active' | 'returned' | 'partial' | 'overdue' | 'cancelled';
  notes?: string;
}

export interface ReturnTrustDTO {
  items: ReturnTrustItemDTO[];
  returnDate: string;
  notes?: string;
}

export interface ReturnTrustItemDTO {
  itemId: string;
  returnedQuantity: number;
  returnedCondition?: 'new' | 'good' | 'used' | 'damaged';
  notes?: string;
}

// ===== نقل العهدة =====
export interface TransferTrustDTO {
  toTrusteeId: string;                // صاحب العهدة الجديد
  toTrusteeType?: 'driver' | 'technician' | 'storekeeper' | 'admin' | 'other';
  toTrusteeName?: string;
  transferDate: string;               // تاريخ نقل العهدة *
  notes?: string;
}