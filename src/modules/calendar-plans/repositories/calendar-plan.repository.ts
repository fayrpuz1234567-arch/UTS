import BaseRepository from '../../../core/repositories/base.repository';
import { CalendarPlan } from '../models/calendar-plan.model';

export class CalendarPlanRepository extends BaseRepository<CalendarPlan> {
  constructor() {
    super('calendarPlans');
  }

  async findByState(state: string): Promise<CalendarPlan[]> {
    return this.findAll({ filter: { state } });
  }

  async findDueOnOrBefore(date: string): Promise<CalendarPlan[]> {
    return this.findAll({ filter: { date: { $lte: date } } });
  }
}
