import { Request, Response } from 'express';
import { AuditService } from '../services/audit.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';

export class AuditController {
  constructor(private auditService: AuditService) {}

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // ✅ FIX: كان بيدعم فلتر واحد بس في المرة (module أو userId أو recordId)
    // وكان بيتجاهل تمامًا الفلاتر التانية اللي صفحة سجل العمليات بترسلها
    // فعليًا (search / status / action / dateFrom / dateTo) وكمان الـ
    // pagination (page / limit)، فكانت النتيجة إما كل السجلات مرة واحدة أو
    // فلتر جزئي مش دقيق. دلوقتي بنقرأ ونمرر كل الفلاتر، بما فيها "action"
    // (نوع العملية: إضافة/تعديل/حذف) اللي الواجهة أضافت select ليها.
    const { module, userId, recordId, status, action, search, dateFrom, dateTo, page, limit } = req.query;

    const result = await this.auditService.getLogsFiltered({
      module: module as string,
      userId: userId as string,
      recordId: recordId as string,
      status: status as any,
      action: action as any,
      search: search as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined
    });

    res.json({
      success: true,
      data: result.data,
      count: result.total,
      total: result.total,
      stats: result.stats
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const log = await this.auditService.getLog(id);
    if (!log) {
      res.status(404).json({ success: false, message: 'Log not found' });
      return;
    }
    res.json({ success: true, data: log });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.auditService.deleteLog(id);
    res.json({ success: true, message: 'Log deleted' });
  });
}