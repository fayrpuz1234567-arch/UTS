export interface AuditLog {
  id: string;
  userId?: string;
  username?: string;
  module: string;
  action: string;
  recordId?: string;
  recordType?: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  changes?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  sessionId?: string;
  status: 'success' | 'failure' | 'warning';
  errorMessage?: string;
  duration?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  isDeleted: boolean;
}

export interface CreateAuditDTO {
  userId?: string;
  username?: string;
  module: string;
  action: string;
  recordId?: string;
  recordType?: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  changes?: Array<{ field: string; oldValue: any; newValue: any }>;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  sessionId?: string;
  status?: 'success' | 'failure' | 'warning';
  errorMessage?: string;
  duration?: number;
  metadata?: Record<string, any>;
}