import { CalendarPlanRepository } from '../repositories/calendar-plan.repository';
import { CalendarPlan, CreateCalendarPlanDTO, UpdateCalendarPlanDTO } from '../models/calendar-plan.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { v4 as uuidv4 } from 'uuid';

export class CalendarPlanService {
  constructor(private planRepo: CalendarPlanRepository) {}

  async getAllPlans(): Promise<CalendarPlan[]> {
    return this.planRepo.findAll();
  }

  async getPlanById(id: string): Promise<CalendarPlan> {
    const plan = await this.planRepo.findById(id);
    if (!plan) throw new AppError('الموعد غير موجود', 404);
    return plan;
  }

  async createPlan(data: CreateCalendarPlanDTO, user?: { id?: string; email?: string }): Promise<CalendarPlan> {
    if (!data || !data.kind || !['mission', 'rental'].includes(data.kind)) {
      throw new AppError('نوع الموعد غير صحيح', 400);
    }
    if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      throw new AppError('التاريخ مطلوب بصيغة صحيحة (YYYY-MM-DD)', 400);
    }

    const planData: Partial<CalendarPlan> = {
      id: uuidv4(),
      kind: data.kind,
      date: data.date,
      entityId: data.entityId || '',
      entityName: data.entityName || '',
      entityType: data.entityType === 'external' ? 'external' : 'internal',
      vehicleId: data.vehicleId || '',
      driverId: data.driverId || '',
      startTime: data.startTime || '',
      notes: data.notes || '',
      state: 'pending',
      lastError: '',
      manualOnly: false,
      createdId: null,
      addedAt: Date.now(),
      createdBy: user?.id,
      createdByName: user?.email,
    };

    return this.planRepo.create(planData);
  }

  async updatePlan(id: string, data: UpdateCalendarPlanDTO): Promise<CalendarPlan> {
    await this.getPlanById(id);
    const updated = await this.planRepo.update(id, data as Partial<CalendarPlan>);
    if (!updated) throw new AppError('تعذر تحديث الموعد', 500);
    return updated;
  }

  async deletePlan(id: string): Promise<boolean> {
    await this.getPlanById(id);
    return this.planRepo.delete(id);
  }
}
