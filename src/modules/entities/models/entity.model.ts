// C:\Users\Amir\fleet-erp\backend\src\modules\entities\models\entity.model.ts

export interface Entity {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  type: 'internal' | 'external' | 'government' | 'private';
  category?: 'college' | 'department' | 'company' | 'individual';
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  taxNumber?: string;
  commercialRegister?: string;
  bankAccount?: string;
  bankName?: string;
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

export interface CreateEntityDTO {
  code: string;
  name: string;
  nameAr?: string;
  type: 'internal' | 'external' | 'government' | 'private';
  category?: 'college' | 'department' | 'company' | 'individual';
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  taxNumber?: string;
  notes?: string;
}

export interface UpdateEntityDTO {
  name?: string;
  nameAr?: string;
  type?: 'internal' | 'external' | 'government' | 'private';
  category?: 'college' | 'department' | 'company' | 'individual';
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  taxNumber?: string;
  isActive?: boolean;
  notes?: string;
}