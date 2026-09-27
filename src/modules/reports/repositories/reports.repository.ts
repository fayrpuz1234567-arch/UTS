import BaseRepository from '../../../core/repositories/base.repository';
import { Report } from '../models/reports.model';

export class ReportRepository extends BaseRepository<Report> {
  constructor() {
    super('reports');
  }

  async findByName(name: string): Promise<Report | null> {
    return this.findOne({ name });
  }

  async findByModule(module: string): Promise<Report[]> {
    return this.findAll({ filter: { module } });
  }

  async findByUser(userId: string): Promise<Report[]> {
    return this.findAll({ 
      filter: { 
        $or: [
          { userId },
          { isPublic: true }
        ]
      } 
    });
  }

  async findPublic(): Promise<Report[]> {
    return this.findAll({ filter: { isPublic: true } });
  }

  async updateLastRun(id: string): Promise<Report | null> {
    return this.update(id, { lastRunAt: new Date().toISOString() });
  }
}