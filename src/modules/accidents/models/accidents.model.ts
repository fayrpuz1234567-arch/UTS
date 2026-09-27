export interface Accident {
  id: string;
  accidentNumber: string;
  vehicleId: string;
  driverId?: string;
  accidentDate: string;
  accidentTime?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  description: string;
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  policeReport?: string;
  insuranceClaimNumber?: string;
  insuranceCompany?: string;
  estimatedCost: number;
  actualCost?: number;
  repairStatus: 'pending' | 'in_progress' | 'completed' | 'rejected';
  images?: string[];
  videos?: string[];
  notes?: string;
  status: 'reported' | 'investigating' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
}

export interface CreateAccidentDTO {
  accidentNumber: string;
  vehicleId: string;
  driverId?: string;
  accidentDate: string;
  accidentTime?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  description: string;
  severity: Accident['severity'];
  policeReport?: string;
  insuranceClaimNumber?: string;
  estimatedCost: number;
  notes?: string;
}

export interface UpdateAccidentDTO {
  accidentDate?: string;
  accidentTime?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  severity?: Accident['severity'];
  policeReport?: string;
  insuranceClaimNumber?: string;
  insuranceCompany?: string;
  estimatedCost?: number;
  actualCost?: number;
  repairStatus?: Accident['repairStatus'];
  notes?: string;
  status?: Accident['status'];
}