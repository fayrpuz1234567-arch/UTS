import { WorkflowRepository } from '../repositories/workflow.repository';
import {
  Workflow,
  CreateWorkflowDTO,
  UpdateWorkflowDTO,
  WorkflowInstance,
  WorkflowStep
} from '../models/workflow.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';

export class WorkflowService {
  constructor(private workflowRepo: WorkflowRepository) {}

  async createWorkflow(data: CreateWorkflowDTO, createdBy: string): Promise<Workflow> {
    const existing = await this.workflowRepo.findByName(data.name);
    if (existing) {
      throw new AppError('Workflow with this name already exists', 409);
    }

    const steps: WorkflowStep[] = data.steps.map((step, index) => ({
      id: `step_${Date.now()}_${index}`,
      name: step.name,
      nameAr: step.nameAr,
      order: step.order,
      role: step.role,
      action: step.action,
      conditions: step.conditions || {},
      nextSteps: [],
      isFinal: step.isFinal || false
    }));

    const workflow = await this.workflowRepo.create({
      ...data,
      steps,
      status: 'draft',
      version: 1,
      isDeleted: false,
      createdBy
    });

    logger.info(`Workflow created: ${workflow.name} (${workflow.id})`);
    return workflow;
  }

  async getWorkflow(id: string): Promise<Workflow> {
    const workflow = await this.workflowRepo.findById(id);
    if (!workflow) {
      throw new AppError('Workflow not found', 404);
    }
    return workflow;
  }

  async getAllWorkflows(filter?: any): Promise<Workflow[]> {
    return this.workflowRepo.findAll({ filter });
  }

  async updateWorkflow(id: string, data: UpdateWorkflowDTO, updatedBy: string): Promise<Workflow> {
    await this.getWorkflow(id);

    const updateData: any = { updatedBy };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.nameAr !== undefined) updateData.nameAr = data.nameAr;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.steps) {
      const steps: WorkflowStep[] = data.steps.map((step, index) => ({
        id: `step_${Date.now()}_${index}`,
        name: step.name,
        nameAr: step.nameAr,
        order: step.order,
        role: step.role,
        action: step.action,
        conditions: step.conditions || {},
        nextSteps: [],
        isFinal: step.isFinal || false
      }));
      updateData.steps = steps;
    }

    const updated = await this.workflowRepo.update(id, updateData);
    if (!updated) {
      throw new AppError('Failed to update workflow', 500);
    }
    logger.info(`Workflow updated: ${updated.name}`);
    return updated;
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    await this.getWorkflow(id);
    return this.workflowRepo.softDelete(id);
  }

  async activateWorkflow(id: string, updatedBy: string): Promise<Workflow> {
    const workflow = await this.getWorkflow(id);
    if (workflow.status !== 'draft') {
      throw new AppError('Only draft workflows can be activated', 400);
    }

    const updated = await this.workflowRepo.updateStatus(id, 'active');
    if (!updated) {
      throw new AppError('Failed to activate workflow', 500);
    }
    logger.info(`Workflow activated: ${updated.name}`);
    return updated;
  }

  async deactivateWorkflow(id: string, updatedBy: string): Promise<Workflow> {
    const workflow = await this.getWorkflow(id);
    if (workflow.status !== 'active') {
      throw new AppError('Only active workflows can be deactivated', 400);
    }

    const updated = await this.workflowRepo.updateStatus(id, 'inactive');
    if (!updated) {
      throw new AppError('Failed to deactivate workflow', 500);
    }
    logger.info(`Workflow deactivated: ${updated.name}`);
    return updated;
  }

  async getWorkflowsByModule(module: string): Promise<Workflow[]> {
    return this.workflowRepo.findByModule(module);
  }

  async getActiveWorkflows(): Promise<Workflow[]> {
    return this.workflowRepo.findActive();
  }

  async startWorkflow(workflowId: string, recordId: string, createdBy: string): Promise<WorkflowInstance> {
    const workflow = await this.getWorkflow(workflowId);
    if (workflow.status !== 'active') {
      throw new AppError('Workflow is not active', 400);
    }

    const instance = await this.workflowRepo.createInstance({
      workflowId: workflow.id,
      module: workflow.module,
      recordId,
      currentStep: workflow.steps[0]?.id || '',
      steps: workflow.steps.map(step => ({
        id: `instance_step_${Date.now()}_${step.id}`,
        workflowStepId: step.id,
        assignedRole: step.role,
        action: step.action,
        status: 'pending'
      })),
      status: 'pending',
      createdBy,
      version: 1
    });

    logger.info(`Workflow instance started: ${instance.id}`);
    return instance;
  }

  async getWorkflowInstance(id: string): Promise<WorkflowInstance> {
    const instance = await this.workflowRepo.getInstance(id);
    if (!instance) {
      throw new AppError('Workflow instance not found', 404);
    }
    return instance;
  }

  async getWorkflowInstances(filter?: any): Promise<WorkflowInstance[]> {
    return this.workflowRepo.getAllInstances(filter);
  }

  async getWorkflowInstancesByRecord(recordId: string): Promise<WorkflowInstance[]> {
    return this.workflowRepo.getInstancesByRecord(recordId);
  }

  async approveStep(instanceId: string, stepId: string, performedBy: string, comment?: string): Promise<WorkflowInstance> {
    const instance = await this.getWorkflowInstance(instanceId);
    const step = instance.steps.find(s => s.id === stepId);
    if (!step) {
      throw new AppError('Step not found', 404);
    }

    if (step.status !== 'pending') {
      throw new AppError('Step already processed', 400);
    }

    // Update step
    step.status = 'approved';
    step.performedBy = performedBy;
    step.performedAt = new Date().toISOString();
    if (comment) step.comment = comment;

    // Check if this is the final step
    const workflow = await this.getWorkflow(instance.workflowId);
    const currentStepDef = workflow.steps.find(s => s.id === step.workflowStepId);

    let status: 'in_progress' | 'completed' = 'in_progress';

    if (currentStepDef?.isFinal) {
      status = 'completed';
    } else {
      // Find next step
      const currentIndex = workflow.steps.findIndex(s => s.id === step.workflowStepId);
      const nextStep = workflow.steps[currentIndex + 1];
      if (nextStep) {
        instance.currentStep = nextStep.id;
        const nextInstanceStep = instance.steps.find(s => s.workflowStepId === nextStep.id);
        if (nextInstanceStep) {
          nextInstanceStep.status = 'pending';
        }
      } else {
        status = 'completed';
      }
    }

    instance.status = status;
    const updated = await this.workflowRepo.updateInstance(instanceId, {
      currentStep: instance.currentStep,
      steps: instance.steps,
      status: instance.status,
      updatedBy: performedBy
    });

    logger.info(`Workflow step approved: ${instanceId} - ${stepId}`);
    return updated;
  }

  async rejectStep(instanceId: string, stepId: string, performedBy: string, comment?: string): Promise<WorkflowInstance> {
    const instance = await this.getWorkflowInstance(instanceId);
    const step = instance.steps.find(s => s.id === stepId);
    if (!step) {
      throw new AppError('Step not found', 404);
    }

    if (step.status !== 'pending') {
      throw new AppError('Step already processed', 400);
    }

    step.status = 'rejected';
    step.performedBy = performedBy;
    step.performedAt = new Date().toISOString();
    if (comment) step.comment = comment;

    instance.status = 'rejected';
    const updated = await this.workflowRepo.updateInstance(instanceId, {
      steps: instance.steps,
      status: instance.status,
      updatedBy: performedBy
    });

    logger.info(`Workflow step rejected: ${instanceId} - ${stepId}`);
    return updated;
  }

  async getWorkflowStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    draft: number;
  }> {
    return this.workflowRepo.getStats();
  }
}