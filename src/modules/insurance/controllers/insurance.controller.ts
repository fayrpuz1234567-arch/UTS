import { Request, Response } from 'express';
import { InsuranceService } from '../services/insurance.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateInsuranceDTO, UpdateInsuranceDTO } from '../models/insurance.model';

export class InsuranceController {
  constructor(private insuranceService: InsuranceService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateInsuranceDTO = req.body;
    const userId = req.user?.id || 'system';
    const insurance = await this.insuranceService.createInsurance(data, userId);
    res.status(201).json({
      success: true,
      message: 'Insurance created successfully',
      data: insurance
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const insurance = await this.insuranceService.getInsurance(id);
    res.json({ success: true, data: insurance });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, vehicleId, company } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (vehicleId) filter.vehicleId = vehicleId;
    if (company) filter.insuranceCompany = company;

    const insurances = await this.insuranceService.getAllInsurances(filter);
    res.json({ success: true, data: insurances, count: insurances.length });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateInsuranceDTO = req.body;
    const userId = req.user?.id || 'system';
    const insurance = await this.insuranceService.updateInsurance(id, data, userId);
    res.json({
      success: true,
      message: 'Insurance updated successfully',
      data: insurance
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.insuranceService.deleteInsurance(id);
    res.json({ success: true, message: 'Insurance deleted successfully' });
  });

  getByVehicle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { vehicleId } = req.params;
    const insurances = await this.insuranceService.getInsurancesByVehicle(vehicleId);
    res.json({ success: true, data: insurances, count: insurances.length });
  });

  getActiveByVehicle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { vehicleId } = req.params;
    const insurance = await this.insuranceService.getActiveByVehicle(vehicleId);
    res.json({ success: true, data: insurance });
  });

  getByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;
    const insurances = await this.insuranceService.getInsurancesByStatus(status);
    res.json({ success: true, data: insurances, count: insurances.length });
  });

  getActive = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const insurances = await this.insuranceService.getActiveInsurances();
    res.json({ success: true, data: insurances, count: insurances.length });
  });

  getExpired = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const insurances = await this.insuranceService.getExpiredInsurances();
    res.json({ success: true, data: insurances, count: insurances.length });
  });

  getExpiringSoon = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { days } = req.params;
    const insurances = await this.insuranceService.getExpiringSoonInsurances(Number(days) || 30);
    res.json({ success: true, data: insurances, count: insurances.length });
  });

  incrementClaims = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const insurance = await this.insuranceService.incrementClaims(id);
    res.json({
      success: true,
      message: 'Claims count incremented',
      data: insurance
    });
  });

  renew = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { expiryDate } = req.body;
    const userId = req.user?.id || 'system';

    if (!expiryDate) {
      res.status(400).json({ success: false, message: 'expiryDate is required' });
      return;
    }

    const insurance = await this.insuranceService.renewInsurance(id, expiryDate, userId);
    res.json({
      success: true,
      message: 'Insurance renewed successfully',
      data: insurance
    });
  });

  cancel = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    const insurance = await this.insuranceService.cancelInsurance(id, userId);
    res.json({
      success: true,
      message: 'Insurance cancelled successfully',
      data: insurance
    });
  });
}