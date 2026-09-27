import { Request, Response } from 'express';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CalendarPlanService } from '../services/calendar-plan.service';

export class CalendarPlanController {
  constructor(private planService: CalendarPlanService) {}

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const plans = await this.planService.getAllPlans();
    res.json({ success: true, data: plans });
  });

  getOne = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const plan = await this.planService.getPlanById(id);
    res.json({ success: true, data: plan });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const plan = await this.planService.createPlan(req.body, req.user);
    res.status(201).json({ success: true, message: 'تمت إضافة الموعد', data: plan });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const plan = await this.planService.updatePlan(id, req.body);
    res.json({ success: true, message: 'تم تحديث الموعد', data: plan });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await this.planService.deletePlan(id);
    res.json({ success: true, message: 'تم حذف الموعد' });
  });
}
