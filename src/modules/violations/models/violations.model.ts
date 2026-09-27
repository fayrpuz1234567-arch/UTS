export interface Violation {
  id: string;
  violationNumber: string;
  vehicleId: string;
  driverId?: string;
  violationDate: string;
  location: string;
  type: 'speeding' | 'parking' | 'traffic_light' | 'driving_license' | 'insurance' | 'other';
  description: string;
  fineAmount: number;
  paidAmount: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'contested';
  paymentDate?: string;
  referenceNumber?: string;
  images?: string[];
  notes?: string;
  status: 'pending' | 'resolved' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
}

export interface CreateViolationDTO {
  violationNumber: string;
  vehicleId: string;
  driverId?: string;
  violationDate: string;
  location: string;
  type: Violation['type'];
  description: string;
  fineAmount: number;
  referenceNumber?: string;
  notes?: string;
}

export interface UpdateViolationDTO {
  violationDate?: string;
  location?: string;
  type?: Violation['type'];
  description?: string;
  fineAmount?: number;
  paidAmount?: number;
  paymentStatus?: Violation['paymentStatus'];
  paymentDate?: string;
  referenceNumber?: string;
  notes?: string;
  status?: Violation['status'];
}