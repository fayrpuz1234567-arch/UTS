// C:\Users\Amir\fleet-erp\backend\src\modules\inventory\controllers\inventory.controller.ts

import { Request, Response } from 'express';
import { InventoryService } from '../services/inventory.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreatePartDTO, UpdatePartDTO, CreateWarehouseDTO, CreateTransactionDTO } from '../models/inventory.model';

export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  // ===== Part Controllers =====
  createPart = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreatePartDTO = req.body;
    const part = await this.inventoryService.createPart(data);
    res.status(201).json({ success: true, message: 'Part created', data: part });
  });

  getPart = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const part = await this.inventoryService.getPart(id);
    res.json({ success: true, data: part });
  });

  getAllParts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parts = await this.inventoryService.getAllParts();
    res.json({ success: true, data: parts, count: parts.length });
  });

  updatePart = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdatePartDTO = req.body;
    const part = await this.inventoryService.updatePart(id, data);
    res.json({ success: true, message: 'Part updated', data: part });
  });

  deletePart = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.inventoryService.deletePart(id);
    res.json({ success: true, message: 'Part deleted' });
  });

  // ✅ جديد: الحصول على قطع المخزون المنخفض
  getLowStock = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parts = await this.inventoryService.getLowStockParts();
    res.json({ success: true, data: parts, count: parts.length });
  });

  // ✅ جديد: الحصول على قطع تحتاج إعادة طلب
  getReorderParts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parts = await this.inventoryService.getReorderParts();
    res.json({ success: true, data: parts, count: parts.length });
  });

  // ✅ جديد: الحصول على قطع منتهية الصلاحية
  getExpiredParts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parts = await this.inventoryService.getExpiredParts();
    res.json({ success: true, data: parts, count: parts.length });
  });

  getLowStockAlerts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const alerts = await this.inventoryService.getLowStockAlerts();
    res.json({ success: true, data: alerts, count: alerts.length });
  });

  // ===== Warehouse Controllers =====
  createWarehouse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateWarehouseDTO = req.body;
    const warehouse = await this.inventoryService.createWarehouse(data);
    res.status(201).json({ success: true, message: 'Warehouse created', data: warehouse });
  });

  getWarehouse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const warehouse = await this.inventoryService.getWarehouse(id);
    res.json({ success: true, data: warehouse });
  });

  getAllWarehouses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const warehouses = await this.inventoryService.getAllWarehouses();
    res.json({ success: true, data: warehouses, count: warehouses.length });
  });

  updateWarehouse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = req.body;
    const warehouse = await this.inventoryService.updateWarehouse(id, data);
    res.json({ success: true, message: 'Warehouse updated', data: warehouse });
  });

  deleteWarehouse = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.inventoryService.deleteWarehouse(id);
    res.json({ success: true, message: 'Warehouse deleted' });
  });

  // ===== Transaction Controllers =====
  createTransaction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateTransactionDTO = req.body;
    const transaction = await this.inventoryService.createTransaction(data);
    res.status(201).json({ success: true, message: 'Transaction created', data: transaction });
  });

  getTransaction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const transaction = await this.inventoryService.getTransaction(id);
    res.json({ success: true, data: transaction });
  });

  getAllTransactions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { partId, warehouseId } = req.query;
    let transactions = [];
    if (partId) {
      transactions = await this.inventoryService.getTransactionsByPart(partId as string);
    } else if (warehouseId) {
      transactions = await this.inventoryService.getTransactionsByWarehouse(warehouseId as string);
    } else {
      transactions = await this.inventoryService.getAllTransactions();
    }
    res.json({ success: true, data: transactions, count: transactions.length });
  });

  approveTransaction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';
    const transaction = await this.inventoryService.approveTransaction(id, userId);
    res.json({ success: true, message: 'Transaction approved', data: transaction });
  });

  rejectTransaction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, message: 'reason is required' });
      return;
    }
    const transaction = await this.inventoryService.rejectTransaction(id, reason);
    res.json({ success: true, message: 'Transaction rejected', data: transaction });
  });

  // ✅ جديد: الحصول على حركات المخزون حسب المرجع
  getTransactionsByReference = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { referenceType, referenceId } = req.query;
    if (!referenceType || !referenceId) {
      res.status(400).json({ success: false, message: 'referenceType and referenceId are required' });
      return;
    }
    const transactions = await this.inventoryService.getTransactionsByReference(
      referenceType as string,
      referenceId as string
    );
    res.json({ success: true, data: transactions, count: transactions.length });
  });

  // ✅ جديد: الحصول على حركات القطعة في فترة
  getPartMovements = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { partId, startDate, endDate } = req.query;
    if (!partId || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'partId, startDate and endDate are required' });
      return;
    }
    const movements = await this.inventoryService.getPartMovements(
      partId as string,
      startDate as string,
      endDate as string
    );
    res.json({ success: true, data: movements });
  });

  // ✅ جديد: إحصائيات المخزون
  getInventoryStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.inventoryService.getInventoryStats();
    res.json({ success: true, data: stats });
  });

  // ✅ جديد: الحصول على حركات المخزون حسب النوع والتاريخ
  getTransactionsByTypeAndDate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { transactionType, startDate, endDate } = req.query;
    if (!transactionType || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'transactionType, startDate and endDate are required' });
      return;
    }
    const transactions = await this.inventoryService.getTransactionsByTypeAndDate(
      transactionType as string,
      startDate as string,
      endDate as string
    );
    res.json({ success: true, data: transactions, count: transactions.length });
  });

  // ✅ جديد: جرد المخزون
  countInventory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { partId } = req.params;
    const { actualQuantity, warehouseId, notes } = req.body;
    const userId = req.user?.id || 'system';

    if (!actualQuantity || !warehouseId) {
      res.status(400).json({ success: false, message: 'actualQuantity and warehouseId are required' });
      return;
    }

    const transaction = await this.inventoryService.countInventory(
      partId,
      actualQuantity,
      warehouseId,
      userId,
      notes
    );
    res.json({ success: true, message: 'Inventory count completed', data: transaction });
  });

  // ✅ جديد: الحصول على حركات الصيانة
  getMaintenanceTransactions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { maintenanceOrderId } = req.params;
    const transactions = await this.inventoryService.getMaintenanceTransactions(maintenanceOrderId);
    res.json({ success: true, data: transactions, count: transactions.length });
  });

  // ✅ جديد: الحصول على حركات المشتريات
  getPurchaseTransactions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { purchaseOrderId } = req.params;
    const transactions = await this.inventoryService.getPurchaseTransactions(purchaseOrderId);
    res.json({ success: true, data: transactions, count: transactions.length });
  });
}