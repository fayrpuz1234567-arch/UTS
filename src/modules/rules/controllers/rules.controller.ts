import { Request, Response } from 'express';
import { RulesService } from '../services/rules.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateRuleDTO, UpdateRuleDTO } from '../models/rules.model';

export class RulesController {
  constructor(private rulesService: RulesService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateRuleDTO = req.body;
    const userId = req.user?.id || 'system';
    const rule = await this.rulesService.createRule(data, userId);
    res.status(201).json({
      success: true,
      message: 'Rule created successfully',
      data: rule
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const rule = await this.rulesService.getRule(id);
    res.json({ success: true, data: rule });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, type, module } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (module) filter.module = module;

    const rules = await this.rulesService.getAllRules(filter);
    res.json({ success: true, data: rules, count: rules.length });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateRuleDTO = req.body;
    const userId = req.user?.id || 'system';
    const rule = await this.rulesService.updateRule(id, data, userId);
    res.json({
      success: true,
      message: 'Rule updated successfully',
      data: rule
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.rulesService.deleteRule(id);
    res.json({ success: true, message: 'Rule deleted successfully' });
  });

  activate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    const rule = await this.rulesService.activateRule(id, userId);
    res.json({
      success: true,
      message: 'Rule activated successfully',
      data: rule
    });
  });

  deactivate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    const rule = await this.rulesService.deactivateRule(id, userId);
    res.json({
      success: true,
      message: 'Rule deactivated successfully',
      data: rule
    });
  });

  getByModule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { module } = req.params;
    const rules = await this.rulesService.getRulesByModule(module);
    res.json({ success: true, data: rules, count: rules.length });
  });

  getByType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type } = req.params;
    const rules = await this.rulesService.getRulesByType(type);
    res.json({ success: true, data: rules, count: rules.length });
  });

  getActive = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const rules = await this.rulesService.getActiveRules();
    res.json({ success: true, data: rules, count: rules.length });
  });

  evaluate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body;
    const result = await this.rulesService.evaluateRule(id, data);
    res.json({
      success: true,
      data: result
    });
  });

  evaluateAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { module } = req.params;
    const data = req.body;
    const results = await this.rulesService.evaluateAllRules(module, data);
    res.json({
      success: true,
      data: results
    });
  });

  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.rulesService.getRuleStats();
    res.json({ success: true, data: stats });
  });
}