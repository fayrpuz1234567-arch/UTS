// ===== Employee Model =====
// موظفون يمكن أن يكونوا أصحاب عهدة (العهدة ليست للسائقين فقط)

export interface Employee {
  id: string;
  employeeCode: string;               // كود الموظف
  fullName: string;                   // الاسم بالكامل
  nationalId?: string;                // الرقم القومي
  phone?: string;
  email?: string;
  jobTitle?: string;                  // المسمى الوظيفي
  department?: string;                // الإدارة / القسم
  employeeType: 'driver' | 'technician' | 'storekeeper' | 'admin' | 'other';
  hireDate?: string;                  // تاريخ التعيين
  status: 'active' | 'inactive' | 'suspended' | 'terminated' | 'on_leave';
  canHoldTrust: boolean;              // ✅ يمكن أن يكون صاحب عهدة
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

export interface CreateEmployeeDTO {
  employeeCode?: string;
  fullName: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  jobTitle?: string;
  department?: string;
  employeeType?: 'driver' | 'technician' | 'storekeeper' | 'admin' | 'other';
  hireDate?: string;
  status?: 'active' | 'inactive' | 'suspended' | 'terminated' | 'on_leave';
  canHoldTrust?: boolean;
  notes?: string;
}

export interface UpdateEmployeeDTO {
  employeeCode?: string;
  fullName?: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  jobTitle?: string;
  department?: string;
  employeeType?: 'driver' | 'technician' | 'storekeeper' | 'admin' | 'other';
  hireDate?: string;
  status?: 'active' | 'inactive' | 'suspended' | 'terminated' | 'on_leave';
  canHoldTrust?: boolean;
  notes?: string;
}
