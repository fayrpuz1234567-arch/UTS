// ===== Part Model =====
export interface Part {
  id: string;
  code: string;
  barcode?: string;
  qrCode?: string;
  name: string;
  nameAr: string;
  categoryId?: string;
  supplierId?: string;
  warehouseId?: string;
  oemNumber?: string;
  compatibleVehicles?: string[];
  unit: 'piece' | 'box' | 'set' | 'liter' | 'meter' | 'kg';
  unitPrice: number;
  lastPurchasePrice?: number;
  averagePrice?: number;
  currentStock: number;
  minimumStock: number;
  maximumStock?: number;
  reorderPoint?: number;
  safetyStock?: number;
  location?: string;
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
  supplierId?: string;
  warehouseId?: string;
  unit: 'piece' | 'box' | 'set' | 'liter' | 'meter' | 'kg';
  unitPrice: number;
  minimumStock: number;
  maximumStock?: number;
  location?: string;
  description?: string;
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
  location?: string;
  description?: string;
  isActive?: boolean;
  notes?: string;
}

// ===== Warehouse Model =====
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
  manager?: string;
  contactPhone?: string;
  contactEmail?: string;
  capacity?: number;
  usedCapacity?: number;
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
  notes?: string;
}

// ===== Inventory Transaction Model =====
export interface InventoryTransaction {
  id: string;
  transactionNumber: string;
  warehouseId: string;
  partId: string;
  transactionType: 'receiving' | 'issue' | 'transfer_in' | 'transfer_out' | 'adjustment_in' | 'adjustment_out' | 'return' | 'damaged' | 'lost' | 'count_adjustment';
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
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