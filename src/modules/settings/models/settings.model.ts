export interface Setting {
  id: string;
  category: string;
  key: string;
  value: any;
  valueType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  isEditable: boolean;
  isEncrypted: boolean;
  group?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  isDeleted: boolean;
  version: number;
}

export interface CreateSettingDTO {
  category: string;
  key: string;
  value: any;
  valueType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  isEditable?: boolean;
  isEncrypted?: boolean;
  group?: string;
  order?: number;
}

export interface UpdateSettingDTO {
  value?: any;
  description?: string;
  isEditable?: boolean;
  isEncrypted?: boolean;
}