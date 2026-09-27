// inventory/models/warehouse.model.ts

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  type: 'main' | 'sub' | 'temporary' | 'virtual';
  branchId?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  manager?: string;                  // ✅ جديد: مسؤول المخزن
  contactPhone?: string;
  contactEmail?: string;
  capacity?: number;                 // ✅ جديد: السعة القصوى
  usedCapacity?: number;             // ✅ جديد: المستخدم
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
}

export interface CreateWarehouseDTO {
  code: string;
  name: string;
  nameAr: string;
  type: 'main' | 'sub' | 'temporary' | 'virtual';
  branchId?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  manager?: string;
  contactPhone?: string;
  contactEmail?: string;
  capacity?: number;
  notes?: string;
}