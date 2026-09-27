// C:\Users\Amir\fleet-erp\backend\src\modules\maintenance\models\scheduled-maintenance.model.ts

export interface ScheduledMaintenance {
  id: string;
  vehicleId: string;
  maintenanceTypeId: string;
  title: string;
  description?: string;
  
  // التاريخ
  scheduledDate: string;
  actualDate?: string;
  
  // الفترات
  intervalDays?: number;        // كل كم يوم
  intervalKM?: number;           // كل كم كيلومتر
  lastPerformedDate?: string;
  lastPerformedKM?: number;
  nextDueDate?: string;
  nextDueKM?: number;
  
  // الحالة
  status: 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // التكرار
  isRecurring: boolean;
  recurrenceType?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'km_based';
  
  // النتائج
  notes?: string;
  cost?: number;
  laborCost?: number;
  partsCost?: number;
  
  // المراجع
  maintenanceOrderId?: string;   // رابط أمر الصيانة المنفذ
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