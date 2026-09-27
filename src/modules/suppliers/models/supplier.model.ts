// C:\Users\Amir\fleet-erp\backend\src\modules\suppliers\models\supplier.model.ts

export interface Supplier {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  contactPerson: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  website?: string;
  address: string;
  taxNumber?: string;
  commercialRegister?: string;
  commercialRegisterExpiry?: string;  // ✅ تاريخ انتهاء السجل التجاري
  isTaxable?: boolean;                // ✅ خاضع للضريبة
  supplierType?: 'parts' | 'maintenance' | 'oil' | 'tires' | 'other';
  bankAccount?: string;
  bankName?: string;
  iban?: string;
  swiftCode?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
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
  metadata?: Record<string, any>;
}

export interface CreateSupplierDTO {
  code: string;
  name: string;
  nameAr?: string;
  contactPerson: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  address: string;
  taxNumber?: string;
  commercialRegister?: string;
  commercialRegisterExpiry?: string;
  isTaxable?: boolean;
  supplierType?: 'parts' | 'maintenance' | 'oil' | 'tires' | 'other';
  notes?: string;
}

export interface UpdateSupplierDTO {
  name?: string;
  nameAr?: string;
  contactPerson?: string;
  phone?: string;
  alternativePhone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  commercialRegister?: string;
  commercialRegisterExpiry?: string;
  isTaxable?: boolean;
  supplierType?: 'parts' | 'maintenance' | 'oil' | 'tires' | 'other';
  bankAccount?: string;
  bankName?: string;
  isApproved?: boolean;
  isActive?: boolean;
  rating?: number;
  notes?: string;
}