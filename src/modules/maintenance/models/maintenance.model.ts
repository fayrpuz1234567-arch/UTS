// ===== Maintenance Order Model =====
export interface MaintenanceOrder {
  id: string;
  orderNumber: string;
  partsAvailable?: boolean;       // ✅ توفر قطع الغيار
  vehicleId: string;
  workshopId?: string;
  maintenanceTypeId?: string;
  assignedTechnician?: string;
  technicianPhone?: string;
  problemDescription: string;
  diagnosis?: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  startKM: number;
  endKM?: number;
  totalKM?: number;
  laborCost: number;
  partsCost: number;
  totalCost: number;
  discount?: number;
  finalCost?: number;
  invoiceNumber?: string;
  invoiceImage?: string;
  images?: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'pending_parts' | 'parts_ordered' | 'parts_received';
  isUnderWarranty: boolean;
  warrantyClaimNumber?: string;
  warrantyStatus?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  completedAt?: string;
  completedBy?: string;
  notes?: string;

  // ===== العلاقات الجديدة =====
  partsNeeded?: MaintenancePart[];
  purchaseRequestId?: string;  // رابط طلب الشراء
  purchaseOrderId?: string;    // رابط أمر الشراء
  receivingNoteId?: string;    // رابط إذن الاستلام

  // ===== المخزون =====
  partsUsed?: MaintenancePartUsed[];

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

// ===== قطع الغيار المطلوبة =====
export interface MaintenancePart {
  partId: string;
  partName?: string;
  partCode?: string;
  quantity: number;
  unit?: string;
  estimatedPrice?: number;
  actualPrice?: number;
  notes?: string;
  status: 'pending' | 'requested' | 'ordered' | 'received' | 'used' | 'returned';
}

// ===== قطع الغيار المستخدمة فعلياً =====
export interface MaintenancePartUsed {
  partId: string;
  partName: string;
  partCode: string;
  quantity: number;
  unit: string;
  price: number;
  totalPrice: number;
  inventoryTransactionId?: string;  // رابط حركة المخزون
  notes?: string;
}

export interface CreateMaintenanceDTO {
  orderNumber: string;
  partsAvailable?: boolean;       // ✅ توفر قطع الغيار
  vehicleId: string;
  workshopId?: string;
  maintenanceTypeId?: string;
  assignedTechnician?: string;
  problemDescription: string;
  diagnosis?: string;
  startDate: string;
  startTime?: string;
  startKM: number;
  laborCost?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  notes?: string;
  partsNeeded?: CreateMaintenancePartDTO[];
}

export interface CreateMaintenancePartDTO {
  partId: string;
  quantity: number;
  estimatedPrice?: number;
  notes?: string;
}

export interface UpdateMaintenanceDTO {
  workshopId?: string;
  maintenanceTypeId?: string;
  assignedTechnician?: string;
  problemDescription?: string;
  diagnosis?: string;
  endDate?: string;
  endTime?: string;
  endKM?: number;
  laborCost?: number;
  partsCost?: number;
  totalCost?: number;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'pending_parts' | 'parts_ordered' | 'parts_received';
  notes?: string;
  partsNeeded?: CreateMaintenancePartDTO[];
  partsUsed?: MaintenancePartUsed[];
}

// ===== Workshop Model =====
export interface Workshop {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  type: 'internal' | 'external' | 'authorized';
  address: string;
  latitude?: number;
  longitude?: number;
  phone: string;
  email?: string;
  manager?: string;
  contactPerson?: string;
  specialization?: string;
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
}

// ===== Workshop DTOs =====
export interface CreateWorkshopDTO {
  code: string;
  name: string;
  nameAr: string;
  type: 'internal' | 'external' | 'authorized';
  address: string;
  latitude?: number;
  longitude?: number;
  phone: string;
  email?: string;
  manager?: string;
  specialization?: string;
  notes?: string;
}

export interface UpdateWorkshopDTO {
  name?: string;
  nameAr?: string;
  type?: 'internal' | 'external' | 'authorized';
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  manager?: string;
  specialization?: string;
  isApproved?: boolean;
  isActive?: boolean;
  notes?: string;
}

// ===== Maintenance Type Model =====
export interface MaintenanceType {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  category: 'preventive' | 'corrective' | 'emergency' | 'periodic';
  description?: string;
  intervalKM?: number;
  intervalDays?: number;
  defaultPriority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  requiresApproval: boolean;
  estimatedDuration?: number;
  estimatedCost?: number;
  isActive: boolean;
  checklistTemplate?: any[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
}

// ===== Maintenance Type DTOs =====
export interface CreateMaintenanceTypeDTO {
  code: string;
  name: string;
  nameAr: string;
  category: 'preventive' | 'corrective' | 'emergency' | 'periodic';
  description?: string;
  intervalKM?: number;
  intervalDays?: number;
  defaultPriority: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  requiresApproval?: boolean;
  estimatedDuration?: number;
  estimatedCost?: number;
  checklistTemplate?: any[];
}

export interface UpdateMaintenanceTypeDTO {
  name?: string;
  nameAr?: string;
  category?: 'preventive' | 'corrective' | 'emergency' | 'periodic';
  description?: string;
  intervalKM?: number;
  intervalDays?: number;
  defaultPriority?: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  requiresApproval?: boolean;
  estimatedDuration?: number;
  estimatedCost?: number;
  isActive?: boolean;
  checklistTemplate?: any[];
}

// ============================================================
// ===== Scheduled Maintenance Models (جديد) =====
// ============================================================

export interface ScheduledMaintenance {
  id: string;
  vehicleId: string;
  maintenanceTypeId: string;
  title: string;
  description?: string;
  
  scheduledDate: string;
  actualDate?: string;
  
  intervalDays?: number;
  intervalKM?: number;
  lastPerformedDate?: string;
  lastPerformedKM?: number;
  nextDueDate?: string;
  nextDueKM?: number;
  
  status: 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  isRecurring: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'km_based';
  
  notes?: string;
  cost?: number;
  laborCost?: number;
  partsCost?: number;
  
  maintenanceOrderId?: string;
  createdBy: string;
  updatedBy?: string;
  
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
  metadata?: Record<string, any>;
}

export interface CreateScheduledMaintenanceDTO {
  vehicleId: string;
  maintenanceTypeId: string;
  title: string;
  description?: string;
  scheduledDate: string;
  intervalDays?: number;
  intervalKM?: number;
  lastPerformedDate?: string;
  lastPerformedKM?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  isRecurring?: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'km_based';
  notes?: string;
}

export interface UpdateScheduledMaintenanceDTO {
  title?: string;
  description?: string;
  scheduledDate?: string;
  actualDate?: string;
  intervalDays?: number;
  intervalKM?: number;
  lastPerformedDate?: string;
  lastPerformedKM?: number;
  nextDueDate?: string;
  nextDueKM?: number;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'overdue';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  isRecurring?: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'km_based';
  notes?: string;
  cost?: number;
  laborCost?: number;
  partsCost?: number;
  maintenanceOrderId?: string;
}