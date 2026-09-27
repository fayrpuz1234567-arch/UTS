export interface Rule {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  description?: string;
  module: string;
  type: 'validation' | 'calculation' | 'workflow' | 'notification' | 'permission';
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
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

export interface RuleCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn';
  value: any;
}

export interface RuleAction {
  type: 'set' | 'add' | 'remove' | 'notify' | 'update_status' | 'assign' | 'create';
  target: string;
  value: any;
}

export interface CreateRuleDTO {
  code: string;
  name: string;
  nameAr: string;
  description?: string;
  module: string;
  type: Rule['type'];
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority?: number;
}

export interface UpdateRuleDTO {
  name?: string;
  nameAr?: string;
  description?: string;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  priority?: number;
  status?: Rule['status'];
}

export interface RuleEvaluationResult {
  matched: boolean;
  actions: RuleAction[];
  data: any;
}