export interface Workflow {
  id: string;
  name: string;
  nameAr: string;
  description?: string;
  module: string;
  steps: WorkflowStep[];
  status: 'draft' | 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  nameAr: string;
  order: number;
  role: string;
  action: string;
  conditions?: Record<string, any>;
  nextSteps?: string[];
  isFinal: boolean;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  module: string;
  recordId: string;
  currentStep: string;
  steps: WorkflowInstanceStep[];
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  isDeleted: boolean;
  version: number;
}

export interface WorkflowInstanceStep {
  id: string;
  workflowStepId: string;
  assignedTo?: string;
  assignedRole: string;
  action: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  comment?: string;
  attachments?: string[];
  performedAt?: string;
  performedBy?: string;
}

export interface CreateWorkflowDTO {
  name: string;
  nameAr: string;
  description?: string;
  module: string;
  steps: CreateWorkflowStepDTO[];
}

export interface CreateWorkflowStepDTO {
  name: string;
  nameAr: string;
  order: number;
  role: string;
  action: string;
  conditions?: Record<string, any>;
  isFinal?: boolean;
}

export interface UpdateWorkflowDTO {
  name?: string;
  nameAr?: string;
  description?: string;
  steps?: CreateWorkflowStepDTO[];
  status?: 'draft' | 'active' | 'inactive';
}