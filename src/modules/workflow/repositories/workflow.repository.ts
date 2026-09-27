import BaseRepository from '../../../core/repositories/base.repository';
import { D1Query } from '../../../core/config/d1.config';
import { Workflow, WorkflowInstance } from '../models/workflow.model';

export class WorkflowRepository extends BaseRepository<Workflow> {
  constructor() {
    super('workflows');
  }

  async findByName(name: string): Promise<Workflow | null> {
    return this.findOne({ name });
  }

  async findByModule(module: string): Promise<Workflow[]> {
    return this.findAll({ filter: { module } });
  }

  async findByStatus(status: string): Promise<Workflow[]> {
    return this.findAll({ filter: { status } });
  }

  async findActive(): Promise<Workflow[]> {
    return this.findAll({ filter: { status: 'active' } });
  }

  async updateStatus(id: string, status: Workflow['status']): Promise<Workflow | null> {
    return this.update(id, { status });
  }

  // ===== Workflow Instance Methods =====
  async createInstance(data: Partial<WorkflowInstance>): Promise<WorkflowInstance> {
    const db = this.db;
    const collection = db.collection('workflow_instances');
    const docRef = collection.doc();
    const now = new Date().toISOString();

    const instance = {
      ...data,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      version: 1
    };

    await docRef.set(instance);
    return instance as WorkflowInstance;
  }

  async getInstance(id: string): Promise<WorkflowInstance | null> {
    const db = this.db;
    const doc = await db.collection('workflow_instances').doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as WorkflowInstance;
  }

  async getAllInstances(filter?: any): Promise<WorkflowInstance[]> {
    const db = this.db;
    let query: D1Query = db.collection('workflow_instances');
    query = query.where('isDeleted', '==', false);

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        query = query.where(key, '==', value);
      });
    }

    const snapshot = await query.get();
    const results: WorkflowInstance[] = [];
    snapshot.forEach(doc => results.push(doc.data() as WorkflowInstance));
    return results;
  }

  async getInstancesByRecord(recordId: string): Promise<WorkflowInstance[]> {
    return this.getAllInstances({ recordId });
  }

  async updateInstance(id: string, data: Partial<WorkflowInstance>): Promise<WorkflowInstance> {
    const db = this.db;
    const docRef = db.collection('workflow_instances').doc(id);
    await docRef.update({
      ...data,
      updatedAt: new Date().toISOString()
    });
    const updated = await docRef.get();
    return updated.data() as WorkflowInstance;
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    draft: number;
  }> {
    const all = await this.findAll();
    const active = all.filter(w => w.status === 'active');
    const inactive = all.filter(w => w.status === 'inactive');
    const draft = all.filter(w => w.status === 'draft');

    return {
      total: all.length,
      active: active.length,
      inactive: inactive.length,
      draft: draft.length
    };
  }
}