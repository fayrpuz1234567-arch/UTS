import { Request, Response } from 'express';
import { ReportsService } from '../services/reports.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateReportDTO, GenerateReportDTO } from '../models/reports.model';
import { logger } from '../../../core/utils/logger';
import { Types } from 'mongoose';

export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  /**
   * Utility method to handle file download with error handling
   */
  private downloadFile = (
    res: Response,
    filePath: string,
    filename: string,
    errorMessage: string = 'حدث خطأ أثناء تحميل الملف'
  ): void => {
    res.download(filePath, filename, (err) => {
      if (err) {
        logger.error('Error downloading file:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: errorMessage,
          });
        }
      }
    });
  };

  /**
   * Utility method to validate date parameters
   */
  private validateDates = (
    startDate: string,
    endDate: string
  ): { valid: boolean; message?: string } => {
    if (!startDate || !endDate) {
      return {
        valid: false,
        message: 'startDate and endDate are required',
      };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        valid: false,
        message: 'Invalid date format. Please use YYYY-MM-DD',
      };
    }

    if (start > end) {
      return {
        valid: false,
        message: 'Start date must be before end date',
      };
    }

    return { valid: true };
  };

  /**
   * Utility method to validate required query parameters
   */
  private validateQueryParams = (
    params: Record<string, any>,
    required: string[]
  ): { valid: boolean; message?: string } => {
    const missing = required.filter((key) => !params[key]);
    if (missing.length > 0) {
      return {
        valid: false,
        message: `Missing required parameters: ${missing.join(', ')}`,
      };
    }
    return { valid: true };
  };

  /**
   * ✅ Utility method to validate a generic resource ID (supports UUID as well
   * as Mongo ObjectId). The app's vehicles (and other entities) use UUIDs
   * like "31f987dc-448a-47f9-af7e-5f758fbeaa81", NOT Mongo ObjectIds, so we
   * can't rely on Types.ObjectId.isValid() for them.
   */
  private isValidResourceId = (id: string): boolean => {
    if (!id || typeof id !== 'string') return false;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    return uuidRegex.test(id) || Types.ObjectId.isValid(id);
  };

  /**
   * Utility method to format date for filename
   */
  private getFormattedDate = (): string => {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  };

  // ============================================================
  // ===== Basic CRUD Operations =====
  // ============================================================

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateReportDTO = req.body;
    const userId = req.user?.id || 'system';
    const report = await this.reportsService.createReport(data, userId);
    res.status(201).json({
      success: true,
      message: 'تم إنشاء التقرير بنجاح',
      data: report,
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid report ID format',
      });
      return;
    }

    const report = await this.reportsService.getReport(id);
    res.json({ success: true, data: report });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id || 'system';
    const { page = 1, limit = 10, type, status } = req.query;

    const filters: any = {};
    if (type) filters.type = type;
    if (status) filters.status = status;

    const result = await this.reportsService.getAllReports(userId, {
      page: Number(page),
      limit: Number(limit),
      filters,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid report ID format',
      });
      return;
    }

    const data = req.body;
    const report = await this.reportsService.updateReport(id, data);
    res.json({
      success: true,
      message: 'تم تحديث التقرير بنجاح',
      data: report,
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid report ID format',
      });
      return;
    }

    await this.reportsService.deleteReport(id);
    res.json({
      success: true,
      message: 'تم حذف التقرير بنجاح',
    });
  });

  generate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: GenerateReportDTO = req.body;
    const result = await this.reportsService.generateReport(data);
    res.json({
      success: true,
      message: 'تم إنشاء التقرير بنجاح',
      data: result,
    });
  });

  export = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { format } = req.query;

    if (!format || !['pdf', 'excel', 'csv'].includes(format as string)) {
      res.status(400).json({
        success: false,
        message: 'format must be one of: pdf, excel, csv',
      });
      return;
    }

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid report ID format',
      });
      return;
    }

    const result = await this.reportsService.exportReport(id, format as any);
    res.json({
      success: true,
      message: 'تم تصدير التقرير بنجاح',
      data: result,
    });
  });

  // ============================================================
  // ===== Generic Report Handler =====
  // ============================================================

  private handleReportGeneration = async (
    req: Request,
    res: Response,
    serviceMethod: Function,
    format?: 'json' | 'excel' | 'pdf'
  ): Promise<void> => {
    const { startDate, endDate } = req.params;
    // ✅ فلتر إضافي اختياري: رقم العربية (يُمرَّر كـ query string)
    const plateNumber =
      typeof req.query.plateNumber === 'string' ? req.query.plateNumber : undefined;

    const dateValidation = this.validateDates(startDate, endDate);
    if (!dateValidation.valid) {
      res.status(400).json({
        success: false,
        message: dateValidation.message,
      });
      return;
    }

    try {
      if (format === 'excel' || format === 'pdf') {
        const filePath = await serviceMethod(startDate, endDate, plateNumber);
        const extension = format === 'excel' ? 'xlsx' : 'pdf';
        const filename = `${req.path.split('/')[1]}_report_${this.getFormattedDate()}.${extension}`;
        this.downloadFile(res, filePath, filename);
      } else {
        const data = await serviceMethod(startDate, endDate, plateNumber);
        res.json({ success: true, data });
      }
    } catch (error) {
      logger.error(`Error generating ${format || 'JSON'} report:`, error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء إنشاء التقرير',
      });
    }
  };

  // ============================================================
  // ===== Vehicle Full Report (Comprehensive) =====
  // ============================================================

  /**
   * Get comprehensive full report for a single vehicle
   * GET /reports/vehicle/:vehicleId/full-report
   */
  getVehicleFullReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { vehicleId } = req.params;

      // ✅ FIX: كان بيستخدم Types.ObjectId.isValid فقط، لكن الـ vehicleId في
      // النظام ده UUID مش Mongo ObjectId، فكان بيرفض كل الطلبات الصحيحة بـ 400
      if (!this.isValidResourceId(vehicleId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid vehicle ID format',
        });
        return;
      }

      try {
        const data = await this.reportsService.getVehicleFullReport(vehicleId);
        res.json({
          success: true,
          data,
        });
      } catch (error: any) {
        logger.error('Error generating vehicle full report:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'حدث خطأ أثناء إنشاء التقرير',
        });
      }
    }
  );

  /**
   * Export comprehensive full report for a single vehicle as Excel
   * GET /reports/vehicle/:vehicleId/full-report/excel
   */
  getVehicleFullReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { vehicleId } = req.params;

      // ✅ FIX: نفس إصلاح التحقق من الـ ID (دعم UUID)
      if (!this.isValidResourceId(vehicleId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid vehicle ID format',
        });
        return;
      }

      try {
        const filePath = await this.reportsService.getVehicleFullReportExcel(
          vehicleId
        );
        const filename = `تقرير_السيارة_الشامل_${this.getFormattedDate()}.xlsx`;
        this.downloadFile(res, filePath, filename);
      } catch (error: any) {
        logger.error('Error generating vehicle full report Excel:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'حدث خطأ أثناء إنشاء التقرير',
        });
      }
    }
  );

  /**
   * Export comprehensive full report for a single vehicle as PDF
   * GET /reports/vehicle/:vehicleId/full-report/pdf
   */
  getVehicleFullReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { vehicleId } = req.params;

      // ✅ FIX: نفس إصلاح التحقق من الـ ID (دعم UUID)
      if (!this.isValidResourceId(vehicleId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid vehicle ID format',
        });
        return;
      }

      try {
        const filePath = await this.reportsService.getVehicleFullReportPDF(
          vehicleId
        );
        const filename = `تقرير_السيارة_الشامل_${this.getFormattedDate()}.pdf`;
        this.downloadFile(res, filePath, filename);
      } catch (error: any) {
        logger.error('Error generating vehicle full report PDF:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'حدث خطأ أثناء إنشاء التقرير',
        });
      }
    }
  );

  // ============================================================
  // ===== Driver Full Report =====
  // ============================================================

  /**
   * Get comprehensive full report for a single driver
   * GET /reports/driver/:driverId/full-report
   */
  getDriverFullReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { driverId } = req.params;

      if (!this.isValidResourceId(driverId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid driver ID format',
        });
        return;
      }

      try {
        const data = await this.reportsService.getDriverFullReport(driverId);
        res.json({
          success: true,
          data,
        });
      } catch (error: any) {
        logger.error('Error generating driver full report:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'حدث خطأ أثناء إنشاء التقرير',
        });
      }
    }
  );

  /**
   * Export comprehensive full report for a single driver as Excel
   * GET /reports/driver/:driverId/full-report/excel
   */
  getDriverFullReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { driverId } = req.params;

      if (!this.isValidResourceId(driverId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid driver ID format',
        });
        return;
      }

      try {
        const filePath = await this.reportsService.getDriverFullReportExcel(
          driverId
        );
        const filename = `تقرير_السائق_الشامل_${this.getFormattedDate()}.xlsx`;
        this.downloadFile(res, filePath, filename);
      } catch (error: any) {
        logger.error('Error generating driver full report Excel:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'حدث خطأ أثناء إنشاء التقرير',
        });
      }
    }
  );

  /**
   * Export comprehensive full report for a single driver as PDF
   * GET /reports/driver/:driverId/full-report/pdf
   */
  getDriverFullReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { driverId } = req.params;

      if (!this.isValidResourceId(driverId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid driver ID format',
        });
        return;
      }

      try {
        const filePath = await this.reportsService.getDriverFullReportPDF(
          driverId
        );
        const filename = `تقرير_السائق_الشامل_${this.getFormattedDate()}.pdf`;
        this.downloadFile(res, filePath, filename);
      } catch (error: any) {
        logger.error('Error generating driver full report PDF:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'حدث خطأ أثناء إنشاء التقرير',
        });
      }
    }
  );

  // ============================================================
  // ===== All Drivers Full Report (تقرير شامل لكل السائقين) =====
  // ============================================================

  /**
   * Export comprehensive full report for ALL drivers (respects the same
   * search/status filters used on the drivers list page) as a single Excel
   * workbook: a per-driver summary sheet plus consolidated sheets for
   * missions/rentals/accidents/violations/fuel across every driver.
   * GET /reports/drivers/full-report/excel?search=&status=
   */
  getAllDriversFullReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { search, status } = req.query;

      try {
        const filePath = await this.reportsService.getAllDriversFullReportExcel({
          search: typeof search === 'string' ? search : undefined,
          status: typeof status === 'string' ? status : undefined,
        });
        const filename = `تقرير_شامل_للسائقين_${this.getFormattedDate()}.xlsx`;
        this.downloadFile(res, filePath, filename);
      } catch (error: any) {
        logger.error('Error generating all-drivers full report Excel:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'حدث خطأ أثناء إنشاء التقرير',
        });
      }
    }
  );


  // ============================================================
  // ===== تقرير السائقين (إيجارات) مع فلتر من / إلى =====
  // ============================================================

  /**
   * GET /reports/drivers/rental-summary?dateFrom=&dateTo=
   */
  getDriversRentalSummary = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { dateFrom, dateTo } = req.query;
      try {
        const data = await this.reportsService.getDriversRentalSummaryReport({
          dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
          dateTo: typeof dateTo === 'string' ? dateTo : undefined,
        });
        res.json({ success: true, data });
      } catch (error: any) {
        logger.error('Error generating drivers rental summary:', error);
        res.status(500).json({ success: false, message: error.message || 'حدث خطأ أثناء إنشاء التقرير' });
      }
    }
  );

  /**
   * GET /reports/drivers/rental-summary/excel?dateFrom=&dateTo=
   */
  getDriversRentalSummaryExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { dateFrom, dateTo } = req.query;
      try {
        const filePath = await this.reportsService.getDriversRentalSummaryReportExcel({
          dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
          dateTo: typeof dateTo === 'string' ? dateTo : undefined,
        });
        this.downloadFile(res, filePath, `تقرير_سائقين_${this.getFormattedDate()}.xlsx`);
      } catch (error: any) {
        logger.error('Error generating drivers rental summary Excel:', error);
        res.status(500).json({ success: false, message: error.message || 'حدث خطأ أثناء إنشاء التقرير' });
      }
    }
  );

  // ============================================================
  // ===== تقرير استهلاك الكروت + إجمالي الوقود =====
  // ============================================================

  /**
   * GET /reports/fuel/cards-consumption/excel?dateFrom=&dateTo=&vehicleId=&plateNumber=
   */
  getFuelCardsConsumptionExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { dateFrom, dateTo, vehicleId, plateNumber } = req.query;
      try {
        const filePath = await this.reportsService.getFuelCardsConsumptionReportExcel({
          dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
          dateTo: typeof dateTo === 'string' ? dateTo : undefined,
          vehicleId: typeof vehicleId === 'string' ? vehicleId : undefined,
          plateNumber: typeof plateNumber === 'string' ? plateNumber : undefined,
        });
        this.downloadFile(res, filePath, `تقرير_استهلاك_كروت_${this.getFormattedDate()}.xlsx`);
      } catch (error: any) {
        logger.error('Error generating fuel cards consumption Excel:', error);
        res.status(500).json({ success: false, message: error.message || 'حدث خطأ أثناء إنشاء التقرير' });
      }
    }
  );

  // ============================================================
  // ===== التقرير الشامل المجمّع (كل التقارير في ملف Excel واحد) =====
  // ============================================================

  /**
   * GET /reports/comprehensive/:startDate/:endDate/excel
   */
  getAllReportsExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { startDate, endDate } = req.params;

      const dateValidation = this.validateDates(startDate, endDate);
      if (!dateValidation.valid) {
        res.status(400).json({ success: false, message: dateValidation.message });
        return;
      }

      try {
        const filePath = await this.reportsService.getAllReportsExcel(startDate, endDate);
        this.downloadFile(res, filePath, `التقرير_الشامل_${this.getFormattedDate()}.xlsx`);
      } catch (error: any) {
        logger.error('Error generating comprehensive Excel report:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'حدث خطأ أثناء إنشاء التقرير الشامل',
        });
      }
    }
  );

  // ============================================================
  // ===== Maintenance Reports =====
  // ============================================================

  getMaintenanceReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.generateMaintenanceReport.bind(this.reportsService)
      );
    }
  );

  getMaintenanceReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getMaintenanceReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getMaintenanceReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getMaintenanceReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // ============================================================
  // ===== Parts Reports =====
  // ============================================================

  getPartsReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.generatePartsConsumptionReport.bind(
          this.reportsService
        )
      );
    }
  );

  getPartsReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getPartsReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getPartsReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getPartsReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // ============================================================
  // ===== Cost Reports =====
  // ============================================================

  getCostReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.generateMaintenanceCostReport.bind(
          this.reportsService
        )
      );
    }
  );

  getCostReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getCostReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getCostReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getCostReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // ============================================================
  // ===== Expenses Reports =====
  // ============================================================

  getExpensesReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getExpensesReport.bind(this.reportsService)
      );
    }
  );

  getExpensesReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getExpensesReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getExpensesReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getExpensesReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // ============================================================
  // ===== Top Reports =====
  // ============================================================

  getTopCostVehiclesReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getTopCostVehicles.bind(this.reportsService)
      );
    }
  );

  getTopCostVehiclesExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getTopCostVehiclesExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getTopCostVehiclesPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getTopCostVehiclesPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  getFrequentIssuesReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getFrequentIssuesReport.bind(this.reportsService)
      );
    }
  );

  getFrequentIssuesExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getFrequentIssuesExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getFrequentIssuesPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getFrequentIssuesPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  getTopFuelConsumptionReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getTopFuelConsumptionVehicles.bind(
          this.reportsService
        )
      );
    }
  );

  getTopFuelConsumptionExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getTopFuelConsumptionExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getTopFuelConsumptionPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getTopFuelConsumptionPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // ============================================================
  // ===== Full Reports =====
  // ============================================================

  getFullReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.generateFullReport.bind(this.reportsService)
      );
    }
  );

  getFullReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getFullReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getFullReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getFullReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // ============================================================
  // ===== Fuel Reports =====
  // ============================================================

  getFuelReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getFuelReport.bind(this.reportsService)
      );
    }
  );

  getFuelReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getFuelReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getFuelReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getFuelReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // ============================================================
  // ===== Vehicles Reports =====
  // ============================================================

  getVehiclesReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getVehiclesReport.bind(this.reportsService)
      );
    }
  );

  getVehiclesReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getVehiclesReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getVehiclesReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getVehiclesReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // ============================================================
  // ===== Missions Reports =====
  // ============================================================

  getMissionsReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getMissionsReport.bind(this.reportsService)
      );
    }
  );

  getMissionsReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getMissionsReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getMissionsReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getMissionsReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // ============================================================
  // ===== Inventory Reports =====
  // ============================================================

  getInventoryReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getInventoryReport.bind(this.reportsService)
      );
    }
  );

  getInventoryReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getInventoryReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getInventoryReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getInventoryReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // ============================================================
  // ===== Purchasing Reports =====
  // ============================================================

  getPurchasingReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getPurchasingReport.bind(this.reportsService)
      );
    }
  );

  getPurchasingReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getPurchasingReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getPurchasingReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleReportGeneration(
        req,
        res,
        this.reportsService.getPurchasingReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // ============================================================
  // ===== Fleet Vehicle Reports (No Date Range) =====
  // ============================================================

  private handleFleetReport = async (
    req: Request,
    res: Response,
    serviceMethod: Function,
    format?: 'json' | 'excel' | 'pdf'
  ): Promise<void> => {
    try {
      if (format === 'excel' || format === 'pdf') {
        const filePath = await serviceMethod();
        const extension = format === 'excel' ? 'xlsx' : 'pdf';
        const filename = `${req.path.split('/')[2] || 'fleet'}_report_${this.getFormattedDate()}.${extension}`;
        this.downloadFile(res, filePath, filename);
      } else {
        const data = await serviceMethod();
        res.json({ success: true, data });
      }
    } catch (error) {
      logger.error(`Error generating fleet ${format || 'JSON'} report:`, error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء إنشاء التقرير',
      });
    }
  };

  // 1. Bus Report
  getBusReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleFleetReport(
        req,
        res,
        this.reportsService.getBusReport.bind(this.reportsService)
      );
    }
  );

  getBusReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleFleetReport(
        req,
        res,
        this.reportsService.getBusReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getBusReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleFleetReport(
        req,
        res,
        this.reportsService.getBusReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // 2. Truck Report
  getTruckReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleFleetReport(
        req,
        res,
        this.reportsService.getTruckReport.bind(this.reportsService)
      );
    }
  );

  getTruckReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleFleetReport(
        req,
        res,
        this.reportsService.getTruckReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getTruckReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleFleetReport(
        req,
        res,
        this.reportsService.getTruckReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // 3. Private Vehicle Report
  getPrivateReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleFleetReport(
        req,
        res,
        this.reportsService.getPrivateReport.bind(this.reportsService)
      );
    }
  );

  getPrivateReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleFleetReport(
        req,
        res,
        this.reportsService.getPrivateReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getPrivateReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleFleetReport(
        req,
        res,
        this.reportsService.getPrivateReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // 4. Fuel Cards Report
  getFuelCardsReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleFleetReport(
        req,
        res,
        this.reportsService.getFuelCardsReport.bind(this.reportsService)
      );
    }
  );

  getFuelCardsReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleFleetReport(
        req,
        res,
        this.reportsService.getFuelCardsReportExcel.bind(this.reportsService),
        'excel'
      );
    }
  );

  getFuelCardsReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleFleetReport(
        req,
        res,
        this.reportsService.getFuelCardsReportPDF.bind(this.reportsService),
        'pdf'
      );
    }
  );

  // ============================================================
  // ===== Rentals Report (With Query Params) =====
  // ============================================================

  private handleRentalsReport = async (
    req: Request,
    res: Response,
    format?: 'json' | 'excel' | 'pdf'
  ): Promise<void> => {
    const { startDate, endDate, plateNumber } = req.query;

    const queryValidation = this.validateQueryParams(
      { startDate, endDate },
      ['startDate', 'endDate']
    );
    if (!queryValidation.valid) {
      res.status(400).json({
        success: false,
        message: queryValidation.message,
      });
      return;
    }

    const dateValidation = this.validateDates(
      startDate as string,
      endDate as string
    );
    if (!dateValidation.valid) {
      res.status(400).json({
        success: false,
        message: dateValidation.message,
      });
      return;
    }

    try {
      if (format === 'excel' || format === 'pdf') {
        const filePath =
          format === 'excel'
            ? await this.reportsService.getRentalsReportExcel(
                startDate as string,
                endDate as string,
                typeof plateNumber === 'string' ? plateNumber : undefined
              )
            : await this.reportsService.getRentalsReportPDF(
                startDate as string,
                endDate as string
              );
        const extension = format === 'excel' ? 'xlsx' : 'pdf';
        const filename = `rentals_report_${this.getFormattedDate()}.${extension}`;
        this.downloadFile(res, filePath, filename);
      } else {
        const data = await this.reportsService.getRentalsReport(
          startDate as string,
          endDate as string,
          typeof plateNumber === 'string' ? plateNumber : undefined
        );
        res.json({ success: true, data });
      }
    } catch (error) {
      logger.error(`Error generating rentals ${format || 'JSON'} report:`, error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء إنشاء التقرير',
      });
    }
  };

  getRentalsReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleRentalsReport(req, res);
    }
  );

  getRentalsReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleRentalsReport(req, res, 'excel');
    }
  );

  getRentalsReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleRentalsReport(req, res, 'pdf');
    }
  );

  // ============================================================
  // ===== Movement Report (With Query Params) =====
  // ============================================================

  private handleMovementReport = async (
    req: Request,
    res: Response,
    format?: 'json' | 'excel' | 'pdf'
  ): Promise<void> => {
    const { vehicleId, startDate, endDate } = req.query;

    const queryValidation = this.validateQueryParams(
      { vehicleId, startDate, endDate },
      ['vehicleId', 'startDate', 'endDate']
    );
    if (!queryValidation.valid) {
      res.status(400).json({
        success: false,
        message: queryValidation.message,
      });
      return;
    }

    const dateValidation = this.validateDates(
      startDate as string,
      endDate as string
    );
    if (!dateValidation.valid) {
      res.status(400).json({
        success: false,
        message: dateValidation.message,
      });
      return;
    }

    // ✅ FIX: نفس إصلاح التحقق من الـ ID (دعم UUID) بدل Types.ObjectId.isValid فقط
    if (!this.isValidResourceId(vehicleId as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid vehicle ID format',
      });
      return;
    }

    try {
      if (format === 'excel' || format === 'pdf') {
        const filePath =
          format === 'excel'
            ? await this.reportsService.getMovementReportExcel(
                vehicleId as string,
                startDate as string,
                endDate as string
              )
            : await this.reportsService.getMovementReportPDF(
                vehicleId as string,
                startDate as string,
                endDate as string
              );
        const extension = format === 'excel' ? 'xlsx' : 'pdf';
        const filename = `movement_report_${this.getFormattedDate()}.${extension}`;
        this.downloadFile(res, filePath, filename);
      } else {
        const data = await this.reportsService.getMovementReport(
          vehicleId as string,
          startDate as string,
          endDate as string
        );
        res.json({ success: true, data });
      }
    } catch (error) {
      logger.error(`Error generating movement ${format || 'JSON'} report:`, error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ أثناء إنشاء التقرير',
      });
    }
  };

  getMovementReport = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleMovementReport(req, res);
    }
  );

  getMovementReportExcel = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleMovementReport(req, res, 'excel');
    }
  );

  getMovementReportPDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      await this.handleMovementReport(req, res, 'pdf');
    }
  );
}