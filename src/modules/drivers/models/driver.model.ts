export interface Driver {
  id: string;
  fullName: string;
  fullNameAr?: string;
  nationalId: string;
  birthDate?: string;
  gender?: 'male' | 'female';
  nationality?: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  address?: string;
  city?: string;
  district?: string;
  hireDate: string;
  contractNumber?: string;
  contractType?: 'permanent' | 'temporary' | 'contractor';
  contractStartDate?: string;
  contractEndDate?: string;
  licenseNumber: string;
  licenseType: string;
  licenseExpiry: string;
  licenseIssueDate?: string;
  licenseIssuingAuthority?: string;
  medicalExpiry?: string;
  trainingCertificates?: string[];
  profileImage?: string;
  assignedVehicleId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  bankAccount?: string;
  bankName?: string;
  salaryAmount?: number;
  salaryFrequency?: 'monthly' | 'weekly' | 'daily';
  status: 'active' | 'inactive' | 'suspended' | 'terminated' | 'on_leave' | 'training';
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

export interface CreateDriverDTO {
  fullName: string;
  fullNameAr?: string;
  nationalId: string;
  birthDate?: string;
  gender?: 'male' | 'female';
  phone: string;
  alternativePhone?: string;
  email?: string;
  address?: string;
  hireDate: string;
  contractNumber?: string;
  contractType?: 'permanent' | 'temporary' | 'contractor';
  licenseNumber: string;
  licenseType: string;
  licenseExpiry: string;
  licenseIssueDate?: string;
  assignedVehicleId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  salaryAmount?: number;
  notes?: string;
}

export interface UpdateDriverDTO {
  fullName?: string;
  fullNameAr?: string;
  phone?: string;
  email?: string;
  address?: string;
  licenseNumber?: string;
  licenseType?: string;
  licenseExpiry?: string;
  status?: 'active' | 'inactive' | 'suspended' | 'terminated' | 'on_leave' | 'training';
  assignedVehicleId?: string;
  salaryAmount?: number;
  notes?: string;
}