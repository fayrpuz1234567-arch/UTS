export interface Insurance {
  id: string;
  policyNumber: string;
  vehicleId: string;
  insuranceCompany: string;
  insuranceType: 'comprehensive' | 'third_party' | 'personal_accident' | 'other';
  coverageAmount: number;
  premiumAmount: number;
  startDate: string;
  expiryDate: string;
  renewalDate?: string;
  policyDocument?: string;
  status: 'active' | 'expired' | 'renewed' | 'cancelled';
  claimsCount: number;
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

export interface CreateInsuranceDTO {
  policyNumber: string;
  vehicleId: string;
  insuranceCompany: string;
  insuranceType: Insurance['insuranceType'];
  coverageAmount: number;
  premiumAmount: number;
  startDate: string;
  expiryDate: string;
  notes?: string;
}

export interface UpdateInsuranceDTO {
  policyNumber?: string;
  insuranceCompany?: string;
  insuranceType?: Insurance['insuranceType'];
  coverageAmount?: number;
  premiumAmount?: number;
  startDate?: string;
  expiryDate?: string;
  status?: Insurance['status'];
  notes?: string;
}