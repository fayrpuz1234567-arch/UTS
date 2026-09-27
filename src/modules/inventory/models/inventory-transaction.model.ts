// C:\Users\Amir\fleet-erp\backend\src\modules\inventory\models\inventory-transaction.model.ts

export interface InventoryTransaction {
  id: string;
  transactionNumber: string;          // رقم الحركة (مولد تلقائي)
  warehouseId: string;
  partId: string;
  transactionType: 
    | 'receiving'      // استلام
    | 'issue'          // صرف
    | 'transfer_in'    // تحويل داخل
    | 'transfer_out'   // تحويل خارج
    | 'adjustment_in'  // تعديل زيادة
    | 'adjustment_out' // تعديل نقص
    | 'return'         // مرتجع
    | 'damaged'        // تالف
    | 'lost'           // ضياع
    | 'count_adjustment'; // جرد
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  balanceBefore: number;             // الرصيد قبل الحركة
  balanceAfter: number;              // الرصيد بعد الحركة
  referenceType?: string;            // نوع المرجع (maintenance, purchase, etc)
  referenceId?: string;              // رقم المرجع
  referenceNumber?: string;          // رقم المرجع النصي
  fromWarehouseId?: string;
  toWarehouseId?: string;
  notes?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy?: string;
  version: number;
  metadata?: Record<string, any>;
}

export interface CreateTransactionDTO {
  warehouseId: string;
  partId: string;
  transactionType: InventoryTransaction['transactionType'];
  quantity: number;
  unitPrice?: number;
  referenceType?: string;
  referenceId?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  notes?: string;
  reason?: string;
}