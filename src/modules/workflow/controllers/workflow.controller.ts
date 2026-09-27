import { Request, Response } from 'express';
import { WorkflowService } from '../services/workflow.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateWorkflowDTO, UpdateWorkflowDTO } from '../models/workflow.model';

export class WorkflowController {
  constructor(private workflowService: WorkflowService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateWorkflowDTO = req.body;
    const userId = req.user?.id || 'system';
    const workflow = await this.workflowService.createWorkflow(data, userId);
    res.status(201).json({
      success: true,
      message: 'Workflow created successfully',
      data: workflow
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const workflow = await this.workflowService.getWorkflow(id);
    res.json({ success: true, data: workflow });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, module } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (module) filter.module = module;

    const workflows = await this.workflowService.getAllWorkflows(filter);
    res.json({ success: true, data: workflows, count: workflows.length });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateWorkflowDTO = req.body;
    const userId = req.user?.id || 'system';
    const workflow = await this.workflowService.updateWorkflow(id, data, userId);
    res.json({
      success: true,
      message: 'Workflow updated successfully',
      data: workflow
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.workflowService.deleteWorkflow(id);
    res.json({ success: true, message: 'Workflow deleted successfully' });
  });

  activate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    const workflow = await this.workflowService.activateWorkflow(id, userId);
    res.json({
      success: true,
      message: 'Workflow activated successfully',
      data: workflow
    });
  });

  deactivate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    const workflow = await this.workflowService.deactivateWorkflow(id, userId);
    res.json({
      success: true,
      message: 'Workflow deactivated successfully',
      data: workflow
    });
  });

  getByModule = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { module } = req.params;
    const workflows = await this.workflowService.getWorkflowsByModule(module);
    res.json({ success: true, data: workflows, count: workflows.length });
  });

  getActive = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const workflows = await this.workflowService.getActiveWorkflows();
    res.json({ success: true, data: workflows, count: workflows.length });
  });

  // ===== Workflow Instance Methods =====
  startInstance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { recordId } = req.body;
    const userId = req.user?.id || 'system';

    if (!recordId) {
      res.status(400).json({ success: false, message: 'recordId is required' });
      return;
    }

    const instance = await this.workflowService.startWorkflow(id, recordId, userId);
    res.status(201).json({
      success: true,
      message: 'Workflow instance started successfully',
      data: instance
    });
  });

  getInstance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const instance = await this.workflowService.getWorkflowInstance(id);
    res.json({ success: true, data: instance });
  });

  getAllInstances = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, module, recordId } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (module) filter.module = module;
    if (recordId) filter.recordId = recordId;

    const instances = await this.workflowService.getWorkflowInstances(filter);
    res.json({ success: true, data: instances, count: instances.length });
  });

  getByRecord = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { recordId } = req.params;
    const instances = await this.workflowService.getWorkflowInstancesByRecord(recordId);
    res.json({ success: true, data: instances, count: instances.length });
  });

  approveStep = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { instanceId, stepId } = req.params;
    const { comment } = req.body;
    const userId = req.user?.id || 'system';

    const instance = await this.workflowService.approveStep(instanceId, stepId, userId, comment);
    res.json({
      success: true,
      message: 'Step approved successfully',
      data: instance
    });
  });

  rejectStep = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { instanceId, stepId } = req.params;
    const { comment } = req.body;
    const userId = req.user?.id || 'system';

    const instance = await this.workflowService.rejectStep(instanceId, stepId, userId, comment);
    res.json({
      success: true,
      message: 'Step rejected successfully',
      data: instance
    });
  });
}