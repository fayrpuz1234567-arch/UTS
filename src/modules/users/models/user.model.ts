export interface User {
  id: string;
  username: string;
  email: string;
  phone?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  passwordHash: string;
  status: 'active' | 'inactive' | 'suspended' | 'locked';
  roles: string[];
  permissions: string[];
  allowedPages: string[];
  departmentId?: string;
  branchId?: string;
  lastLoginAt?: string;
  lastLoginIP?: string;
  lastLoginDevice?: string;
  failedLoginAttempts: number;
  accountLockedUntil?: string;
  passwordChangedAt?: string;
  sessionTimeout: number;
  preferences?: Record<string, any>;
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

export interface CreateUserDTO {
  username: string;
  email: string;
  phone?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  password: string;
  roles?: string[];
  allowedPages?: string[];
  departmentId?: string;
  branchId?: string;
  status?: 'active' | 'inactive' | 'suspended';
}

export interface UpdateUserDTO {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  profileImage?: string;
  status?: 'active' | 'inactive' | 'suspended' | 'locked';
  departmentId?: string;
  branchId?: string;
  roles?: string[];
  permissions?: string[];
  allowedPages?: string[];
  preferences?: Record<string, any>;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}