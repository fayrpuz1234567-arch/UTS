export interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  type: 'rental' | 'service' | 'supply' | 'maintenance' | 'insurance' | 'other';
  entityId?: string;
  entityName: string;
  supplierId?: string;
  supplierName?: string;
  startDate: string;
  endDate: string;
  renewalDate?: string;
  value: number;
  paymentTerms?: string;
  status: 'draft' | 'active' | 'expired' | 'renewed' | 'cancelled' | 'terminated';
  documents?: string[];
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

export interface CreateContractDTO {
  contractNumber: string;
  title: string;
  type: Contract['type'];
  entityId?: string;
  entityName: string;
  supplierId?: string;
  supplierName?: string;
  startDate: string;
  endDate: string;
  value: number;
  paymentTerms?: string;
  notes?: string;
}

export interface UpdateContractDTO {
  title?: string;
  type?: Contract['type'];
  entityId?: string;
  entityName?: string;
  supplierId?: string;
  supplierName?: string;
  startDate?: string;
  endDate?: string;
  value?: number;
  paymentTerms?: string;
  status?: Contract['status'];
  notes?: string;
}