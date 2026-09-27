import { Request, Response } from 'express';
import { ContractService } from '../services/contract.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateContractDTO, UpdateContractDTO } from '../models/contracts.model';

export class ContractController {
  constructor(private contractService: ContractService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateContractDTO = req.body;
    const userId = req.user?.id || 'system';
    const contract = await this.contractService.createContract(data, userId);
    res.status(201).json({
      success: true,
      message: 'Contract created successfully',
      data: contract
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const contract = await this.contractService.getContract(id);
    res.json({ success: true, data: contract });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, type, entityId, supplierId } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (entityId) filter.entityId = entityId;
    if (supplierId) filter.supplierId = supplierId;

    const contracts = await this.contractService.getAllContracts(filter);
    res.json({ success: true, data: contracts, count: contracts.length });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateContractDTO = req.body;
    const userId = req.user?.id || 'system';
    const contract = await this.contractService.updateContract(id, data, userId);
    res.json({
      success: true,
      message: 'Contract updated successfully',
      data: contract
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.contractService.deleteContract(id);
    res.json({ success: true, message: 'Contract deleted successfully' });
  });

  activate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    const contract = await this.contractService.activateContract(id, userId);
    res.json({
      success: true,
      message: 'Contract activated successfully',
      data: contract
    });
  });

  cancel = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    const contract = await this.contractService.cancelContract(id, userId);
    res.json({
      success: true,
      message: 'Contract cancelled successfully',
      data: contract
    });
  });

  renew = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { endDate } = req.body;
    const userId = req.user?.id || 'system';

    if (!endDate) {
      res.status(400).json({ success: false, message: 'endDate is required' });
      return;
    }

    const contract = await this.contractService.renewContract(id, endDate, userId);
    res.json({
      success: true,
      message: 'Contract renewed successfully',
      data: contract
    });
  });

  getByType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type } = req.params;
    const contracts = await this.contractService.getContractsByType(type);
    res.json({ success: true, data: contracts, count: contracts.length });
  });

  getByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;
    const contracts = await this.contractService.getContractsByStatus(status);
    res.json({ success: true, data: contracts, count: contracts.length });
  });

  getActive = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const contracts = await this.contractService.getActiveContracts();
    res.json({ success: true, data: contracts, count: contracts.length });
  });

  getExpired = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const contracts = await this.contractService.getExpiredContracts();
    res.json({ success: true, data: contracts, count: contracts.length });
  });

  getExpiringSoon = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { days } = req.params;
    const contracts = await this.contractService.getExpiringSoonContracts(Number(days) || 30);
    res.json({ success: true, data: contracts, count: contracts.length });
  });
}