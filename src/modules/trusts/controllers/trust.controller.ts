// C:\Users\Amir\fleet-erp\backend\src\modules\trusts\controllers\trust.controller.ts

import { Request, Response } from 'express';
import { TrustService } from '../services/trust.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateTrustDTO, UpdateTrustDTO, ReturnTrustDTO, TransferTrustDTO } from '../models/trust.model';

export class TrustController {
  constructor(private trustService: TrustService) {}

  // ===== Create Trust =====
  createTrust = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateTrustDTO = req.body;
    const userId = req.user?.id || 'system';
    const trust = await this.trustService.createTrust(data, userId);
    res.status(201).json({ success: true, message: 'Trust created', data: trust });
  });

  // ===== Get Trust =====
  getTrust = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const trust = await this.trustService.getTrust(id);
    res.json({ success: true, data: trust });
  });

  // ===== Get All Trusts =====
  getAllTrusts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, trusteeId, trusteeType } = req.query;
    let filter: any = {};
    if (status) filter.status = status;
    if (trusteeId) filter.trusteeId = trusteeId;
    if (trusteeType) filter.trusteeType = trusteeType;

    const trusts = await this.trustService.getAllTrusts(filter);
    res.json({ success: true, data: trusts, count: trusts.length });
  });

  // ===== Update Trust =====
  updateTrust = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateTrustDTO = req.body;
    const trust = await this.trustService.updateTrust(id, data);
    res.json({ success: true, message: 'Trust updated', data: trust });
  });

  // ===== Delete Trust =====
  deleteTrust = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.trustService.deleteTrust(id);
    res.json({ success: true, message: 'Trust deleted' });
  });

  // ===== Return Trust =====
  returnTrust = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: ReturnTrustDTO = req.body;
    const userId = req.user?.id || 'system';
    const trust = await this.trustService.returnTrust(id, data, userId);
    res.json({ success: true, message: 'Trust returned successfully', data: trust });
  });

  // ===== Transfer Trust =====
  transferTrust = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: TransferTrustDTO = req.body;
    const userId = req.user?.id || 'system';
    const trust = await this.trustService.transferTrust(id, data, userId);
    res.json({ success: true, message: 'Trust transferred successfully', data: trust });
  });

  // ===== Cancel Trust =====
  cancelTrust = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, message: 'reason is required' });
      return;
    }
    const userId = req.user?.id || 'system';
    const trust = await this.trustService.cancelTrust(id, reason, userId);
    res.json({ success: true, message: 'Trust cancelled', data: trust });
  });

  // ===== Get Trusts by Trustee =====
  getTrustsByTrustee = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { trusteeId } = req.params;
    const trusts = await this.trustService.getTrustsByTrustee(trusteeId);
    res.json({ success: true, data: trusts, count: trusts.length });
  });

  // ===== Get Trusts by Status =====
  getTrustsByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;
    const trusts = await this.trustService.getTrustsByStatus(status);
    res.json({ success: true, data: trusts, count: trusts.length });
  });

  // ===== Get Active Trusts =====
  getActiveTrusts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const trusts = await this.trustService.getActiveTrusts();
    res.json({ success: true, data: trusts, count: trusts.length });
  });

  // ===== Get Overdue Trusts =====
  getOverdueTrusts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const trusts = await this.trustService.getOverdueTrusts();
    res.json({ success: true, data: trusts, count: trusts.length });
  });

  // ===== Get Trust Stats =====
  getTrustStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.trustService.getTrustStats();
    res.json({ success: true, data: stats });
  });
}