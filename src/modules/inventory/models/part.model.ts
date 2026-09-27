// FleetERP-Backend/src/modules/inventory/models/part.model.ts

export interface Part {
  id: string;
  code: string;
  barcode?: string;                    // ✅ جديد: كود مميز (باركود)
  qrCode?: string;                     // ✅ جديد: QR Code
  name: string;
  nameAr: string;
  categoryId?: string;
  supplierId?: string;                // ✅ جديد: المورد الأساسي
  warehouseId?: string;
  oemNumber?: string;
  compatibleVehicles?: string[];
  unit: 'piece' | 'box' | 'set' | 'liter' | 'meter' | 'kg';
  unitPrice: number;
  lastPurchasePrice?: number;
  averagePrice?: number;
  currentStock: number;
  minimumStock: number;               // ✅ جديد: حد أدنى
  maximumStock?: number;              // ✅ جديد: حد أقصى
  reorderPoint?: number;              // ✅ جديد: نقطة إعادة الطلب
  safetyStock?: number;               // ✅ جديد: مخزون أمان
  location?: string;                  // ✅ جديد: موقع القطعة
  shelf?: string;
  row?: string;
  bin?: string;
  image?: string;
  description?: string;
  specifications?: Record<string, any>;
  isConsumable: boolean;
  isActive: boolean;
  leadTimeDays?: number;
  warrantyMonths?: number;
  notes?: string;
  
  // ✅ جديد: تاريخ انتهاء الصلاحية (للزيوت والمواد)
  expiryDate?: string;
  
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

export interface CreatePartDTO {
  code: string;
  barcode?: string;
  name: string;
  nameAr: string;
  categoryId?: string;
  supplierId?: string;               // ✅ جديد
  warehouseId?: string;
  unit: 'piece' | 'box' | 'set' | 'liter' | 'meter' | 'kg';
  unitPrice: number;
  minimumStock: number;              // ✅ جديد
  maximumStock?: number;             // ✅ جديد
  reorderPoint?: number;             // ✅ جديد
  safetyStock?: number;              // ✅ جديد
  location?: string;
  description?: string;
  expiryDate?: string;               // ✅ جديد
  notes?: string;
}

export interface UpdatePartDTO {
  code?: string;
  barcode?: string;
  name?: string;
  nameAr?: string;
  categoryId?: string;
  supplierId?: string;
  warehouseId?: string;
  unit?: 'piece' | 'box' | 'set' | 'liter' | 'meter' | 'kg';
  unitPrice?: number;
  minimumStock?: number;
  maximumStock?: number;
  reorderPoint?: number;
  safetyStock?: number;
  location?: string;
  description?: string;
  isActive?: boolean;
  expiryDate?: string;
  notes?: string;
}