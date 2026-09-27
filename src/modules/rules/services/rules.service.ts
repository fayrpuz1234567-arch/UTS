import { RuleRepository } from '../repositories/rules.repository';
import { Rule, CreateRuleDTO, UpdateRuleDTO, RuleCondition, RuleAction, RuleEvaluationResult } from '../models/rules.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';

export class RulesService {
  constructor(private ruleRepo: RuleRepository) {}

  async createRule(data: CreateRuleDTO, createdBy: string): Promise<Rule> {
    const existing = await this.ruleRepo.findByCode(data.code);
    if (existing) {
      throw new AppError('Rule with this code already exists', 409);
    }

    const rule = await this.ruleRepo.create({
      ...data,
      priority: data.priority || 0,
      status: 'draft',
      version: 1,
      isDeleted: false,
      createdBy
    });

    logger.info(`Rule created: ${rule.code} (${rule.id})`);
    return rule;
  }

  async getRule(id: string): Promise<Rule> {
    const rule = await this.ruleRepo.findById(id);
    if (!rule) {
      throw new AppError('Rule not found', 404);
    }
    return rule;
  }

  async getAllRules(filter?: any): Promise<Rule[]> {
    return this.ruleRepo.findAll({ filter });
  }

  async updateRule(id: string, data: UpdateRuleDTO, updatedBy: string): Promise<Rule> {
    await this.getRule(id);
    const updated = await this.ruleRepo.update(id, { ...data, updatedBy });
    if (!updated) {
      throw new AppError('Failed to update rule', 500);
    }
    logger.info(`Rule updated: ${updated.code}`);
    return updated;
  }

  async deleteRule(id: string): Promise<boolean> {
    await this.getRule(id);
    return this.ruleRepo.softDelete(id);
  }

  async activateRule(id: string, updatedBy: string): Promise<Rule> {
    const rule = await this.getRule(id);
    if (rule.status !== 'draft' && rule.status !== 'inactive') {
      throw new AppError('Only draft or inactive rules can be activated', 400);
    }

    const updated = await this.ruleRepo.updateStatus(id, 'active');
    if (!updated) {
      throw new AppError('Failed to activate rule', 500);
    }
    logger.info(`Rule activated: ${updated.code}`);
    return updated;
  }

  async deactivateRule(id: string, updatedBy: string): Promise<Rule> {
    const rule = await this.getRule(id);
    if (rule.status !== 'active') {
      throw new AppError('Only active rules can be deactivated', 400);
    }

    const updated = await this.ruleRepo.updateStatus(id, 'inactive');
    if (!updated) {
      throw new AppError('Failed to deactivate rule', 500);
    }
    logger.info(`Rule deactivated: ${updated.code}`);
    return updated;
  }

  async getRulesByModule(module: string): Promise<Rule[]> {
    return this.ruleRepo.findByModule(module);
  }

  async getRulesByType(type: string): Promise<Rule[]> {
    return this.ruleRepo.findByType(type);
  }

  async getActiveRules(): Promise<Rule[]> {
    return this.ruleRepo.findActive();
  }

  async evaluateRule(ruleId: string, data: any): Promise<RuleEvaluationResult> {
    const rule = await this.getRule(ruleId);
    if (rule.status !== 'active') {
      throw new AppError('Rule is not active', 400);
    }

    const matched = this.evaluateConditions(rule.conditions, data);
    return {
      matched,
      actions: matched ? rule.actions : [],
      data
    };
  }

  private evaluateConditions(conditions: RuleCondition[], data: any): boolean {
    for (const condition of conditions) {
      const value = this.getNestedValue(data, condition.field);
      if (!this.evaluateCondition(value, condition)) {
        return false;
      }
    }
    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private evaluateCondition(value: any, condition: RuleCondition): boolean {
    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'ne': return value !== condition.value;
      case 'gt': return value > condition.value;
      case 'gte': return value >= condition.value;
      case 'lt': return value < condition.value;
      case 'lte': return value <= condition.value;
      case 'contains': return String(value).includes(String(condition.value));
      case 'startsWith': return String(value).startsWith(String(condition.value));
      case 'endsWith': return String(value).endsWith(String(condition.value));
      case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
      case 'notIn': return Array.isArray(condition.value) && !condition.value.includes(value);
      default: return false;
    }
  }

  async evaluateAllRules(module: string, data: any): Promise<RuleEvaluationResult[]> {
    const rules = await this.ruleRepo.findActiveByModule(module);
    const results: RuleEvaluationResult[] = [];

    for (const rule of rules) {
      const result = await this.evaluateRule(rule.id, data);
      results.push(result);
    }

    return results;
  }

  async getRuleStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    draft: number;
    byModule: Record<string, number>;
    byType: Record<string, number>;
  }> {
    return this.ruleRepo.getStats();
  }
}