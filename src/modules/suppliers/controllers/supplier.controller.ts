// C:\Users\Amir\fleet-erp\backend\src\modules\suppliers\controllers\supplier.controller.ts

import { Request, Response } from 'express';
import { SupplierService } from '../services/supplier.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateSupplierDTO, UpdateSupplierDTO } from '../models/supplier.model';

export class SupplierController {
  constructor(private supplierService: SupplierService) {}

  createSupplier = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateSupplierDTO = req.body;
    const supplier = await this.supplierService.createSupplier(data);
    res.status(201).json({ success: true, message: 'Supplier created', data: supplier });
  });

  getSupplier = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const supplier = await this.supplierService.getSupplier(id);
    res.json({ success: true, data: supplier });
  });

  getAllSuppliers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type, isActive } = req.query;
    let filter: any = {};
    if (type) filter.supplierType = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const suppliers = await this.supplierService.getAllSuppliers(filter);
    res.json({ success: true, data: suppliers, count: suppliers.length });
  });

  updateSupplier = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateSupplierDTO = req.body;
    const supplier = await this.supplierService.updateSupplier(id, data);
    res.json({ success: true, message: 'Supplier updated', data: supplier });
  });

  deleteSupplier = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.supplierService.deleteSupplier(id);
    res.json({ success: true, message: 'Supplier deleted' });
  });

  getActiveSuppliers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const suppliers = await this.supplierService.getActiveSuppliers();
    res.json({ success: true, data: suppliers, count: suppliers.length });
  });

  getTaxableSuppliers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const suppliers = await this.supplierService.getTaxableSuppliers();
    res.json({ success: true, data: suppliers, count: suppliers.length });
  });

  getSuppliersByType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type } = req.params;
    const suppliers = await this.supplierService.getSuppliersByType(type);
    res.json({ success: true, data: suppliers, count: suppliers.length });
  });

  checkCommercialRegisterExpiry = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.supplierService.checkCommercialRegisterExpiry(id);
    res.json({ success: true, data: result });
  });

  getExpiredCommercialRegisterSuppliers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const suppliers = await this.supplierService.getExpiredCommercialRegisterSuppliers();
    res.json({ success: true, data: suppliers, count: suppliers.length });
  });

  updateSupplierRating = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { rating } = req.body;
    if (rating === undefined || rating === null) {
      res.status(400).json({ success: false, message: 'rating is required' });
      return;
    }
    const supplier = await this.supplierService.updateSupplierRating(id, rating);
    res.json({ success: true, message: 'Supplier rating updated', data: supplier });
  });

  getSupplierStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.supplierService.getSupplierStats();
    res.json({ success: true, data: stats });
  });
}