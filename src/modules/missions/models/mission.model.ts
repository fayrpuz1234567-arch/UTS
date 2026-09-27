export interface Mission {
  id: string;
  missionNumber: string;
  missionType?: string;
  vehicleId?: string;
  driverId?: string;
  entityId?: string;
  entityName?: string;
  requester: string;
  requesterPhone?: string;
  requesterDepartment?: string;
  purpose: string;
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  expectedEndDate?: string;
  expectedEndTime?: string;
  startKM: number;
  endKM?: number;
  totalKM?: number;
  fuelConsumed?: number;
  fuelCost?: number;
  route?: string;
  waypoints?: any[];
  notes?: string;
  attachments?: string[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'scheduled' | 'active' | 'completed' | 'cancelled' | 'delayed' | 'pending_approval';
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'under_review';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  completedAt?: string;
  completedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
  metadata?: Record<string, any>;

  // ✅ الحقول الجديدة للتقارير
  orderNumber?: string;     // رقم أمر الشغل
  driverName?: string;      // اسم السائق
}

export interface CreateMissionDTO {
  missionNumber: string;
  missionType?: string;
  vehicleId?: string;
  driverId?: string;
  entityName?: string;
  requester: string;
  requesterPhone?: string;
  requesterDepartment?: string;
  purpose: string;
  startDate: string;
  startTime: string;
  expectedEndDate?: string;
  expectedEndTime?: string;
  startKM: number;
  route?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;

  // ✅ الحقول الجديدة للتقارير
  orderNumber?: string;
  driverName?: string;
}

export interface UpdateMissionDTO {
  missionType?: string;
  entityName?: string;
  requester?: string;
  requesterPhone?: string;
  purpose?: string;
  endDate?: string;
  endTime?: string;
  expectedEndDate?: string;
  expectedEndTime?: string;
  endKM?: number;
  totalKM?: number;
  fuelConsumed?: number;
  fuelCost?: number;
  route?: string;
  notes?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled' | 'delayed';

  // ✅ الحقول الجديدة للتقارير
  orderNumber?: string;
  driverName?: string;
}