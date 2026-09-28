import { ReportRepository } from '../repositories/reports.repository';
import { Report, CreateReportDTO, GenerateReportDTO } from '../models/reports.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';
import ExcelJS = require('exceljs');
import PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';
// ✅ FIX: مكتبات تشكيل الحروف العربية (reshaping) وترتيب الاتجاه (bidi) —
// من غيرهم PDFKit بيرسم الكود بوينتس زي ما هي من غير ما يوصل الحروف ببعضها
// ولا يعكس اتجاه القراءة، فالنتيجة نص عربي مقطّع ومقلوب
// @ts-ignore
import * as arabicReshaper from 'arabic-reshaper';
// @ts-ignore
import bidiFactory = require('bidi-js');const bidi = bidiFactory();
import { MaintenanceOrderRepository } from '../../maintenance/repositories/maintenance.repository';
import { PurchaseOrderRepository } from '../../purchasing/repositories/purchasing.repository';
import { PartRepository } from '../../inventory/repositories/inventory.repository';
import { InventoryTransactionRepository } from '../../inventory/repositories/inventory.repository';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { FuelLogRepository } from '../../fuel/repositories/fuel.repository';
import { FuelCardRepository } from '../../fuel/repositories/fuel.repository';
import { RentalRepository } from '../../rentals/repositories/rental.repository';
import { MissionRepository } from '../../missions/repositories/mission.repository';
import { DriverRepository } from '../../drivers/repositories/driver.repository';
import { EntityRepository } from '../../entities/repositories/entity.repository';
import { AccidentRepository } from '../../accidents/repositories/accident.repository';
import { ViolationRepository } from '../../violations/repositories/violation.repository';

export class ReportsService {
  constructor(
    private reportRepo: ReportRepository,
    private maintenanceRepo?: MaintenanceOrderRepository,
    private purchaseRepo?: PurchaseOrderRepository,
    private partRepo?: PartRepository,
    private transactionRepo?: InventoryTransactionRepository,
    private vehicleRepo?: VehicleRepository,
    private fuelLogRepo?: FuelLogRepository,
    private fuelCardRepo?: FuelCardRepository,
    private rentalRepo?: RentalRepository,
    private missionRepo?: MissionRepository,
    private driverRepo?: DriverRepository,
    private entityRepo?: EntityRepository,
    private accidentRepo?: AccidentRepository,
    private violationRepo?: ViolationRepository
  ) {}

  // ============================================================
  // ===== CRUD Operations for Reports =====
  // ============================================================

  async createReport(data: CreateReportDTO, userId: string): Promise<Report> {
    const existing = await this.reportRepo.findByName(data.name);
    if (existing) {
      throw new AppError('Report with this name already exists', 409);
    }

    const report = await this.reportRepo.create({
      ...data,
      isPublic: data.isPublic || false,
      userId,
      version: 1,
      isDeleted: false
    });

    logger.info(`Report created: ${report.name} (${report.id})`);
    return report;
  }

  async getReport(id: string): Promise<Report> {
    const report = await this.reportRepo.findById(id);
    if (!report) {
      throw new AppError('Report not found', 404);
    }
    return report;
  }

  async getAllReports(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      filters?: { type?: string; status?: string };
    }
  ): Promise<{
    data: Report[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const allReports = await this.reportRepo.findByUser(userId);

    let filtered: Report[] = allReports;
    const filters = options?.filters || {};

    if (filters.type) {
      filtered = filtered.filter((r: any) => r.type === filters.type);
    }
    if (filters.status) {
      filtered = filtered.filter((r: any) => r.status === filters.status);
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const limit = options?.limit && options.limit > 0 ? options.limit : 10;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return {
      data,
      pagination: { page, limit, total, totalPages },
    };
  }

  async updateReport(id: string, data: Partial<Report>): Promise<Report> {
    await this.getReport(id);
    const updated = await this.reportRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update report', 500);
    }
    logger.info(`Report updated: ${updated.name}`);
    return updated;
  }

  async deleteReport(id: string): Promise<boolean> {
    await this.getReport(id);
    return this.reportRepo.softDelete(id);
  }

  async generateReport(data: GenerateReportDTO): Promise<any> {
    const report = await this.getReport(data.reportId);

    await this.reportRepo.updateLastRun(data.reportId);

    const query: any = {
      module: report.module,
      filters: { ...report.filters, ...(data.additionalFilters || {}) }
    };

    if (data.dateRange) {
      query.filters.createdAt = {
        $gte: data.dateRange.from,
        $lte: data.dateRange.to
      };
    }

    const result = {
      report: report,
      data: await this.fetchReportData(query),
      generatedAt: new Date().toISOString(),
      format: data.format
    };

    logger.info(`Report generated: ${report.name} in ${data.format} format`);
    return result;
  }

  private async fetchReportData(query: any): Promise<any[]> {
    // Placeholder - سيتم تنفيذه لاحقاً
    return [
      { id: '1', name: 'Sample Data 1', value: 100 },
      { id: '2', name: 'Sample Data 2', value: 200 },
      { id: '3', name: 'Sample Data 3', value: 300 }
    ];
  }

  async exportReport(reportId: string, format: 'pdf' | 'excel' | 'csv'): Promise<any> {
    const report = await this.getReport(reportId);
    const result = await this.generateReport({
      reportId,
      format
    });

    return {
      success: true,
      message: `Report exported as ${format.toUpperCase()}`,
      data: result,
      format,
      filename: `${report.name}.${format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'csv'}`
    };
  }

  // ============================================================
  // ===== تقرير السيارة الشامل (Full Vehicle Report) =====
  // ============================================================

  async getVehicleFullReport(vehicleId: string): Promise<any> {
    if (!this.vehicleRepo) {
      throw new AppError('Vehicle repository not initialized', 500);
    }

    // جلب بيانات السيارة
    const vehicle = await this.vehicleRepo.findById(vehicleId);
    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }

    // جلب جميع البيانات المرتبطة بالسيارة
    const [fuelLogs, missions, maintenanceOrders, rentals, accidents, violations] = await Promise.all([
      this.fuelLogRepo?.findAll({ filter: { vehicleId } }) || [],
      this.missionRepo?.findAll({ filter: { vehicleId } }) || [],
      this.maintenanceRepo?.findAll({ filter: { vehicleId } }) || [],
      this.rentalRepo?.findAll({ filter: { vehicleId } }) || [],
      this.accidentRepo?.findAll({ filter: { vehicleId } }) || [],
      this.violationRepo?.findAll({ filter: { vehicleId } }) || []
    ]);

    // حساب الإحصائيات (نفس الأرقام المعروضة بالضبط في كروت الصفحة)
    const summary = {
      totalFuelLogs: fuelLogs.length,
      totalFuel: fuelLogs.reduce((sum, f) => sum + (f.fuelQuantity || 0), 0),
      totalFuelCost: fuelLogs.reduce((sum, f) => sum + (f.totalCost || 0), 0),
      totalMissions: missions.length,
      totalKM: missions.reduce((sum, m) => sum + (m.totalKM || 0), 0),
      totalMaintenance: maintenanceOrders.length,
      totalMaintenanceCost: maintenanceOrders.reduce((sum, m) => sum + (m.totalCost || 0), 0),
      totalRentals: rentals.length,
      totalRentalValue: rentals.reduce((sum, r) => sum + (r.totalPrice || r.rentalValue || 0), 0),
      totalAccidents: accidents.length,
      totalViolations: violations.length,
      totalFines: violations.reduce((sum, v) => sum + (v.fineAmount || 0), 0)
    };

    return {
      vehicle,
      fuel: fuelLogs,
      missions,
      maintenance: maintenanceOrders,
      rentals,
      accidents,
      violations,
      summary
    };
  }

  // ============================================================
  // ===== تصدير Excel لتقرير السيارة الشامل =====
  // ✅ مطابق حرفيًا لما هو معروض في صفحة "تقرير السيارة الشامل":
  //    نفس بيانات السيارة، نفس أرقام الكروت (الملخص)، ونفس أعمدة كل جدول
  //    بنفس ترتيبها الظاهر في الصفحة (الوقود / المأموريات / الصيانة /
  //    الإيجارات / الحوادث / المخالفات).
  // ============================================================

  async getVehicleFullReportExcel(vehicleId: string): Promise<string> {
    const data = await this.getVehicleFullReport(vehicleId);
    const vehicle = data.vehicle;

    const workbook = new ExcelJS.Workbook();

    // ===== الورقة 1: بيانات السيارة (نفس الحقول الظاهرة أعلى الصفحة) =====
    const vehicleSheet = this.createArabicWorksheet(workbook, 'بيانات السيارة');
    const vehicleHeaders = ['الخاصية', 'القيمة'];
    const vehicleHeaderRow = vehicleSheet.addRow(vehicleHeaders);
    this.styleHeaderRow(vehicleHeaderRow);

    // نفس ترتيب الحقول الظاهرة بالضبط في قسم "بيانات السيارة" بالصفحة
    const vehicleFields = [
      ['رقم اللوحة', vehicle.plateNumber || '-'],
      ['النوع', vehicle.vehicleType || '-'],
      ['الموديل', `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || '-'],
      ['اللون', vehicle.color || '-'],
      ['سنة الصنع', vehicle.manufactureYear || '-'],
      ['نوع الوقود', vehicle.fuelType || '-'],
      ['العداد الحالي', `${(vehicle.currentKM || 0).toLocaleString()} كم`],
      ['حالة الرخصة', vehicle.licenseStatus || '-'],
      // ===== بيانات إضافية غير ظاهرة في كروت الصفحة لكنها مفيدة للتقرير =====
      ['رقم الشاسيه', vehicle.chassisNumber || ''],
      ['رقم المحرك', vehicle.engineNumber || ''],
      ['رقم الرخصة', vehicle.licenseNumber || ''],
      ['تاريخ الترخيص', vehicle.licenseDate || ''],
      ['انتهاء الرخصة', vehicle.licenseExpiry || ''],
      ['مكان التواجد', vehicle.location || ''],
      ['الحالة الفنية', vehicle.technicalCondition || ''],
      ['الحالة', vehicle.status || '']
    ];

    vehicleFields.forEach(([key, value]) => {
      const row = vehicleSheet.addRow([key, value]);
      this.styleDataRow(row);
    });

    this.autoFitColumns(vehicleSheet);

    // ===== الورقة 2: الملخص (نفس كروت الإحصائيات الثمانية في الصفحة + عدادات الحوادث/المخالفات) =====
    const summarySheet = this.createArabicWorksheet(workbook, 'الملخص');
    const summaryHeaders = ['المؤشر', 'القيمة'];
    const summaryHeaderRow = summarySheet.addRow(summaryHeaders);
    this.styleHeaderRow(summaryHeaderRow);

    // ✅ نفس ترتيب الكروت الثمانية الظاهرة في statsContainer بالصفحة بالظبط
    const summaryFields = [
      ['عمليات التموين', data.summary.totalFuelLogs.toString()],
      ['إجمالي الوقود (لتر)', data.summary.totalFuel.toFixed(0)],
      ['تكلفة الوقود (ج.م)', data.summary.totalFuelCost.toFixed(0)],
      ['المأموريات', data.summary.totalMissions.toString()],
      ['إجمالي المسافة (كم)', data.summary.totalKM.toLocaleString()],
      ['أوامر الصيانة', data.summary.totalMaintenance.toString()],
      ['تكلفة الصيانة (ج.م)', data.summary.totalMaintenanceCost.toFixed(0)],
      ['قيمة الإيجارات (ج.م)', data.summary.totalRentalValue.toFixed(0)],
      // مؤشرات إضافية موجودة كعدادات فوق جدولي الحوادث والمخالفات في الصفحة
      ['عدد الحوادث', data.summary.totalAccidents.toString()],
      ['عدد المخالفات', data.summary.totalViolations.toString()],
      ['إجمالي الغرامات (ج.م)', data.summary.totalFines.toFixed(0)]
    ];

    summaryFields.forEach(([key, value]) => {
      const row = summarySheet.addRow([key, value]);
      this.styleDataRow(row);
    });

    this.autoFitColumns(summarySheet);

    // ===== الورقة 3: الوقود (نفس أعمدة جدول الوقود بالصفحة بالضبط) =====
    const fuelSheet = this.createArabicWorksheet(workbook, 'الوقود');
    const fuelHeaders = ['التاريخ', 'الكمية (لتر)', 'سعر الوحدة', 'التكلفة', 'المسافة (كم)', 'نوع الوقود'];
    const fuelHeaderRow = fuelSheet.addRow(fuelHeaders);
    this.styleHeaderRow(fuelHeaderRow);

    (data.fuel || []).forEach((f: any) => {
      // ✅ إصلاح: الصفحة بتعرض حقل "date"، وكان الإكسيل بيقرأ "createdAt" بس
      // فيطلع فاضي لو الداتا مخزّنة تحت اسم "date". دلوقتي بيجرب الاتنين.
      const rawDate = f.date || f.createdAt;
      const row = fuelSheet.addRow([
        rawDate ? new Date(rawDate).toLocaleDateString('ar-EG') : '',
        f.fuelQuantity || 0,
        f.unitPrice || 0,
        f.totalCost || 0,
        f.distanceSinceLastFuel || 0,
        f.fuelType || ''
      ]);
      this.styleDataRow(row);
    });
    this.autoFitColumns(fuelSheet);

    // ===== الورقة 4: المأموريات (نفس أعمدة الصفحة) =====
    const missionSheet = this.createArabicWorksheet(workbook, 'المأموريات');
    const missionHeaders = ['رقم المأمورية', 'تاريخ البداية', 'تاريخ النهاية', 'عداد الخروج', 'عداد الدخول', 'المسافة', 'الجهة', 'الحالة'];
    const missionHeaderRow = missionSheet.addRow(missionHeaders);
    this.styleHeaderRow(missionHeaderRow);

    (data.missions || []).forEach((m: any) => {
      const row = missionSheet.addRow([
        m.missionNumber || m.orderNumber || '',
        m.startDate ? new Date(m.startDate).toLocaleDateString('ar-EG') : '',
        m.endDate ? new Date(m.endDate).toLocaleDateString('ar-EG') : '',
        m.startKM || 0,
        m.endKM || 0,
        m.totalKM || 0,
        m.entityName || '',
        m.status || ''
      ]);
      this.styleDataRow(row);
    });
    this.autoFitColumns(missionSheet);

    // ===== الورقة 5: الصيانة (نفس أعمدة الصفحة) =====
    const maintenanceSheet = this.createArabicWorksheet(workbook, 'الصيانة');
    const maintenanceHeaders = ['رقم الأمر', 'تاريخ البداية', 'تاريخ النهاية', 'المشكلة', 'تكلفة العمالة', 'تكلفة قطع الغيار', 'الإجمالي', 'الحالة'];
    const maintenanceHeaderRow = maintenanceSheet.addRow(maintenanceHeaders);
    this.styleHeaderRow(maintenanceHeaderRow);

    (data.maintenance || []).forEach((m: any) => {
      const row = maintenanceSheet.addRow([
        m.orderNumber || '',
        m.startDate ? new Date(m.startDate).toLocaleDateString('ar-EG') : '',
        m.endDate ? new Date(m.endDate).toLocaleDateString('ar-EG') : '',
        m.problemDescription || '',
        m.laborCost || 0,
        m.partsCost || 0,
        m.totalCost || 0,
        m.status || ''
      ]);
      this.styleDataRow(row);
    });
    this.autoFitColumns(maintenanceSheet);

    // ===== الورقة 6: الإيجارات (نفس أعمدة الصفحة) =====
    const rentalSheet = this.createArabicWorksheet(workbook, 'الإيجارات');
    const rentalHeaders = ['رقم الإيجار', 'تاريخ البداية', 'تاريخ النهاية', 'المستأجر', 'القيمة', 'الحالة'];
    const rentalHeaderRow = rentalSheet.addRow(rentalHeaders);
    this.styleHeaderRow(rentalHeaderRow);

    (data.rentals || []).forEach((r: any) => {
      const row = rentalSheet.addRow([
        r.rentalNumber || '',
        r.startDate ? new Date(r.startDate).toLocaleDateString('ar-EG') : '',
        r.endDate ? new Date(r.endDate).toLocaleDateString('ar-EG') : '',
        r.renterName || r.entityName || '',
        r.totalPrice || r.rentalValue || 0,
        r.status || ''
      ]);
      this.styleDataRow(row);
    });
    this.autoFitColumns(rentalSheet);

    // ===== الورقة 7: الحوادث (نفس أعمدة الصفحة) =====
    const accidentSheet = this.createArabicWorksheet(workbook, 'الحوادث');
    const accidentHeaders = ['رقم الحادث', 'التاريخ', 'الموقع', 'الوصف', 'الخطورة', 'التكلفة', 'الحالة'];
    const accidentHeaderRow = accidentSheet.addRow(accidentHeaders);
    this.styleHeaderRow(accidentHeaderRow);

    (data.accidents || []).forEach((a: any) => {
      const row = accidentSheet.addRow([
        a.accidentNumber || '',
        a.accidentDate ? new Date(a.accidentDate).toLocaleDateString('ar-EG') : '',
        a.location || '',
        a.description || '',
        a.severity || '',
        a.estimatedCost || 0,
        a.status || ''
      ]);
      this.styleDataRow(row);
    });
    this.autoFitColumns(accidentSheet);

    // ===== الورقة 8: المخالفات (نفس أعمدة الصفحة) =====
    const violationSheet = this.createArabicWorksheet(workbook, 'المخالفات');
    const violationHeaders = ['رقم المخالفة', 'التاريخ', 'الموقع', 'النوع', 'الوصف', 'الغرامة', 'حالة الدفع', 'الحالة'];
    const violationHeaderRow = violationSheet.addRow(violationHeaders);
    this.styleHeaderRow(violationHeaderRow);

    (data.violations || []).forEach((v: any) => {
      const row = violationSheet.addRow([
        v.violationNumber || '',
        v.violationDate ? new Date(v.violationDate).toLocaleDateString('ar-EG') : '',
        v.location || '',
        v.type || '',
        v.description || '',
        v.fineAmount || 0,
        v.paymentStatus || '',
        v.status || ''
      ]);
      this.styleDataRow(row);
    });
    this.autoFitColumns(violationSheet);

    // حفظ الملف
    const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `تقرير_السيارة_${vehicle.plateNumber || vehicleId}_${Date.now()}.xlsx`;
    const filePath = path.join(uploadDir, filename);
    await workbook.xlsx.writeFile(filePath);

    logger.info(`✅ Vehicle full report exported: ${filePath}`);
    return filePath;
  }

  // ============================================================
  // ===== تصدير PDF لتقرير السيارة الشامل =====
  // ============================================================

  async getVehicleFullReportPDF(vehicleId: string): Promise<string> {
    const data = await this.getVehicleFullReport(vehicleId);
    const vehicle = data.vehicle;
    const title = `تقرير السيارة الشامل - ${vehicle.plateNumber || vehicleId}`;
    return this.exportToPDF(data, `تقرير_السيارة_${vehicle.plateNumber || vehicleId}_${Date.now()}.pdf`, title);
  }

  // ============================================================
  // ===== تقرير السائق الشامل =====
  // ✅ نفس منطق تقرير السيارة الشامل: يجمع كل البيانات المرتبطة
  //    بسائق معيّن (مأموريات / إيجارات / حوادث / مخالفات / تموين وقود
  //    لو موجود) في مكان واحد، مع ملخص إحصائي.
  // ============================================================

  async getDriverFullReport(driverId: string): Promise<any> {
    if (!this.driverRepo) {
      throw new AppError('Driver repository not initialized', 500);
    }

    // جلب بيانات السائق
    const driver = await this.driverRepo.findById(driverId);
    if (!driver) {
      throw new AppError('Driver not found', 404);
    }

    // جلب جميع البيانات المرتبطة بالسائق (كل كوليكشن بيتفلتر بـ driverId
    // لو المستودع موجود؛ أي مستودع مش متاح أو مفيهوش driverId هيرجع مصفوفة فاضية)
    const [missions, rentals, accidents, violations, fuelLogs] = await Promise.all([
      this.missionRepo?.findAll({ filter: { driverId } }) || [],
      this.rentalRepo?.findAll({ filter: { driverId } }) || [],
      this.accidentRepo?.findAll({ filter: { driverId } }) || [],
      this.violationRepo?.findAll({ filter: { driverId } }) || [],
      this.fuelLogRepo?.findAll({ filter: { driverId } }) || []
    ]);

    const summary = {
      totalMissions: missions.length,
      totalKM: missions.reduce((sum, m) => sum + (m.totalKM || (m.endKM || 0) - (m.startKM || 0) || 0), 0),
      totalRentals: rentals.length,
      totalRentalValue: rentals.reduce((sum, r) => sum + (r.totalPrice || r.rentalValue || 0), 0),
      totalAccidents: accidents.length,
      totalViolations: violations.length,
      totalFines: violations.reduce((sum, v) => sum + (v.fineAmount || 0), 0),
      totalFuelLogs: fuelLogs.length,
      totalFuelCost: fuelLogs.reduce((sum, f) => sum + (f.totalCost || 0), 0)
    };

    return {
      driver,
      missions,
      rentals,
      accidents,
      violations,
      fuel: fuelLogs,
      summary
    };
  }

  // ============================================================
  // ===== تصدير Excel لتقرير السائق الشامل =====
  // ============================================================

  async getDriverFullReportExcel(driverId: string): Promise<string> {
    const data = await this.getDriverFullReport(driverId);
    const driver = data.driver;

    const workbook = new ExcelJS.Workbook();

    // ===== الورقة 1: بيانات السائق =====
    const driverSheet = this.createArabicWorksheet(workbook, 'بيانات السائق');
    const driverHeaderRow = driverSheet.addRow(['الخاصية', 'القيمة']);
    this.styleHeaderRow(driverHeaderRow);

    const statusLabels: Record<string, string> = {
      active: 'نشط', inactive: 'غير نشط', suspended: 'موقوف',
      terminated: 'منتهي', on_leave: 'في إجازة', training: 'تدريب'
    };
    const licenseStatusLabel = this.computeDriverLicenseStatus(driver.licenseExpiry);

    const driverFields: [string, any][] = [
      ['الاسم الكامل', driver.fullName || '-'],
      ['رقم الهوية', driver.nationalId || '-'],
      ['رقم الهاتف', driver.phone || '-'],
      ['البريد الإلكتروني', driver.email || ''],
      ['تاريخ الميلاد', driver.birthDate || ''],
      ['رقم الرخصة', driver.licenseNumber || '-'],
      ['انتهاء الرخصة', driver.licenseExpiry || '-'],
      ['حالة الرخصة', licenseStatusLabel],
      ['تاريخ التعيين', driver.hireDate || ''],
      ['الحالة العامة', statusLabels[driver.status] || driver.status || ''],
      ['ملاحظات', driver.notes || '']
    ];

    driverFields.forEach(([key, value]) => {
      this.styleDataRow(driverSheet.addRow([key, value]));
    });
    this.autoFitColumns(driverSheet);

    // ===== الورقة 2: الملخص =====
    const summarySheet = this.createArabicWorksheet(workbook, 'الملخص');
    const summaryHeaderRow = summarySheet.addRow(['المؤشر', 'القيمة']);
    this.styleHeaderRow(summaryHeaderRow);

    const summaryFields: [string, string][] = [
      ['عدد المأموريات', data.summary.totalMissions.toString()],
      ['إجمالي المسافة (كم)', data.summary.totalKM.toLocaleString()],
      ['عدد الإيجارات', data.summary.totalRentals.toString()],
      ['قيمة الإيجارات (ج.م)', data.summary.totalRentalValue.toFixed(0)],
      ['عدد الحوادث', data.summary.totalAccidents.toString()],
      ['عدد المخالفات', data.summary.totalViolations.toString()],
      ['إجمالي الغرامات (ج.م)', data.summary.totalFines.toFixed(0)],
      ['عمليات التموين', data.summary.totalFuelLogs.toString()],
      ['تكلفة الوقود (ج.م)', data.summary.totalFuelCost.toFixed(0)]
    ];
    summaryFields.forEach(([key, value]) => {
      this.styleDataRow(summarySheet.addRow([key, value]));
    });
    this.autoFitColumns(summarySheet);

    // ===== الورقة 3: المأموريات =====
    const missionSheet = this.createArabicWorksheet(workbook, 'المأموريات');
    const missionHeaderRow = missionSheet.addRow(['رقم المأمورية', 'تاريخ البداية', 'تاريخ النهاية', 'رقم السيارة', 'عداد الخروج', 'عداد الدخول', 'المسافة', 'الجهة', 'الحالة']);
    this.styleHeaderRow(missionHeaderRow);
    (data.missions || []).forEach((m: any) => {
      this.styleDataRow(missionSheet.addRow([
        m.missionNumber || m.orderNumber || '',
        m.startDate ? new Date(m.startDate).toLocaleDateString('ar-EG') : '',
        m.endDate ? new Date(m.endDate).toLocaleDateString('ar-EG') : '',
        m.plateNumber || m.vehicleId || '',
        m.startKM || 0,
        m.endKM || 0,
        m.totalKM || (m.endKM || 0) - (m.startKM || 0) || 0,
        m.entityName || '',
        m.status || ''
      ]));
    });
    this.autoFitColumns(missionSheet);

    // ===== الورقة 4: الإيجارات =====
    const rentalSheet = this.createArabicWorksheet(workbook, 'الإيجارات');
    const rentalHeaderRow = rentalSheet.addRow(['رقم أمر الشغل', 'تاريخ البداية', 'تاريخ النهاية', 'الجهة', 'رقم السيارة', 'القيمة', 'الحالة']);
    this.styleHeaderRow(rentalHeaderRow);
    (data.rentals || []).forEach((r: any) => {
      this.styleDataRow(rentalSheet.addRow([
        r.orderNumber || r.rentalNumber || '',
        r.startDate ? new Date(r.startDate).toLocaleDateString('ar-EG') : '',
        r.endDate ? new Date(r.endDate).toLocaleDateString('ar-EG') : '',
        r.entityName || r.renterName || '',
        r.plateNumber || r.vehicleId || '',
        r.totalPrice || r.rentalValue || 0,
        r.status || ''
      ]));
    });
    this.autoFitColumns(rentalSheet);

    // ===== الورقة 5: الحوادث =====
    const accidentSheet = this.createArabicWorksheet(workbook, 'الحوادث');
    const accidentHeaderRow = accidentSheet.addRow(['رقم الحادث', 'التاريخ', 'رقم السيارة', 'الموقع', 'الوصف', 'الخطورة', 'التكلفة', 'الحالة']);
    this.styleHeaderRow(accidentHeaderRow);
    (data.accidents || []).forEach((a: any) => {
      this.styleDataRow(accidentSheet.addRow([
        a.accidentNumber || '',
        a.accidentDate ? new Date(a.accidentDate).toLocaleDateString('ar-EG') : '',
        a.plateNumber || a.vehicleId || '',
        a.location || '',
        a.description || '',
        a.severity || '',
        a.estimatedCost || 0,
        a.status || ''
      ]));
    });
    this.autoFitColumns(accidentSheet);

    // ===== الورقة 6: المخالفات =====
    const violationSheet = this.createArabicWorksheet(workbook, 'المخالفات');
    const violationHeaderRow = violationSheet.addRow(['رقم المخالفة', 'التاريخ', 'رقم السيارة', 'الموقع', 'النوع', 'الوصف', 'الغرامة', 'حالة الدفع', 'الحالة']);
    this.styleHeaderRow(violationHeaderRow);
    (data.violations || []).forEach((v: any) => {
      this.styleDataRow(violationSheet.addRow([
        v.violationNumber || '',
        v.violationDate ? new Date(v.violationDate).toLocaleDateString('ar-EG') : '',
        v.plateNumber || v.vehicleId || '',
        v.location || '',
        v.type || '',
        v.description || '',
        v.fineAmount || 0,
        v.paymentStatus || '',
        v.status || ''
      ]));
    });
    this.autoFitColumns(violationSheet);

    // ===== الورقة 7: التموين بالوقود (لو مرتبط بالسائق) =====
    const fuelSheet = this.createArabicWorksheet(workbook, 'التموين');
    const fuelHeaderRow = fuelSheet.addRow(['التاريخ', 'رقم السيارة', 'الكمية (لتر)', 'التكلفة']);
    this.styleHeaderRow(fuelHeaderRow);
    (data.fuel || []).forEach((f: any) => {
      const rawDate = f.date || f.createdAt;
      this.styleDataRow(fuelSheet.addRow([
        rawDate ? new Date(rawDate).toLocaleDateString('ar-EG') : '',
        f.plateNumber || f.vehicleId || '',
        f.fuelQuantity || 0,
        f.totalCost || 0
      ]));
    });
    this.autoFitColumns(fuelSheet);

    // حفظ الملف
    const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `تقرير_السائق_${driver.fullName || driverId}_${Date.now()}.xlsx`;
    const filePath = path.join(uploadDir, filename);
    await workbook.xlsx.writeFile(filePath);

    logger.info(`✅ Driver full report exported: ${filePath}`);
    return filePath;
  }

  // ============================================================
  // ===== تصدير PDF لتقرير السائق الشامل =====
  // ============================================================

  async getDriverFullReportPDF(driverId: string): Promise<string> {
    const data = await this.getDriverFullReport(driverId);
    const driver = data.driver;
    const title = `تقرير السائق الشامل - ${driver.fullName || driverId}`;
    return this.exportToPDF(data, `تقرير_السائق_${driver.fullName || driverId}_${Date.now()}.pdf`, title);
  }

  // ============================================================
  // ===== تقرير شامل لكل السائقين (قايمة كاملة) =====
  // ✅ نفس منطق تقرير السائق الشامل، لكن بيتطبق على كل سائق موجود في
  //    القايمة (بعد تطبيق فلاتر البحث/الحالة لو موجودة) وبيجمع بياناتهم
  //    كلها (مأموريات/إيجارات/حوادث/مخالفات/تموين) في تقرير واحد.
  // ============================================================

  async getAllDriversFullReport(
    filters?: { search?: string; status?: string }
  ): Promise<any[]> {
    if (!this.driverRepo) {
      throw new AppError('Driver repository not initialized', 500);
    }

    const filter: Record<string, any> = {};
    if (filters?.status) {
      filter.status = filters.status;
    }

    let drivers = await this.driverRepo.findAll({ filter });

    if (filters?.search) {
      const q = filters.search.trim().toLowerCase();
      drivers = drivers.filter((d: any) =>
        (d.fullName || '').toLowerCase().includes(q) ||
        (d.nationalId || '').toLowerCase().includes(q) ||
        (d.licenseNumber || '').toLowerCase().includes(q) ||
        (d.phone || '').toLowerCase().includes(q)
      );
    }

    // لكل سائق، بنجيب تقريره الشامل بالتوازي (نفس المنطق المستخدم لتقرير
    // السائق الواحد، بس بيتكرر لكل سائق في القايمة)
    return Promise.all(drivers.map((d: any) => this.getDriverFullReport(d.id)));
  }

  // ============================================================
  // ===== تصدير Excel لتقرير شامل لكل السائقين =====
  // ============================================================

  async getAllDriversFullReportExcel(
    filters?: { search?: string; status?: string }
  ): Promise<string> {
    const reports = await this.getAllDriversFullReport(filters);

    const workbook = new ExcelJS.Workbook();
    const statusLabels: Record<string, string> = {
      active: 'نشط', inactive: 'غير نشط', suspended: 'موقوف',
      terminated: 'منتهي', on_leave: 'في إجازة', training: 'تدريب'
    };

    // ===== الورقة 1: ملخص كل السائقين =====
    const summarySheet = this.createArabicWorksheet(workbook, 'ملخص السائقين');
    const summaryHeaderRow = summarySheet.addRow([
      'الاسم', 'رقم الهوية', 'الهاتف', 'رقم الرخصة', 'حالة الرخصة', 'انتهاء الرخصة',
      'الحالة العامة', 'عدد المأموريات', 'إجمالي المسافة (كم)', 'عدد الإيجارات',
      'قيمة الإيجارات (ج.م)', 'عدد الحوادث', 'عدد المخالفات', 'إجمالي الغرامات (ج.م)',
      'عمليات التموين', 'تكلفة الوقود (ج.م)'
    ]);
    this.styleHeaderRow(summaryHeaderRow);

    reports.forEach((r: any) => {
      const d = r.driver;
      this.styleDataRow(summarySheet.addRow([
        d.fullName || '-',
        d.nationalId || '-',
        d.phone || '-',
        d.licenseNumber || '-',
        this.computeDriverLicenseStatus(d.licenseExpiry),
        d.licenseExpiry || '-',
        statusLabels[d.status] || d.status || '',
        r.summary.totalMissions,
        r.summary.totalKM.toLocaleString(),
        r.summary.totalRentals,
        r.summary.totalRentalValue.toFixed(0),
        r.summary.totalAccidents,
        r.summary.totalViolations,
        r.summary.totalFines.toFixed(0),
        r.summary.totalFuelLogs,
        r.summary.totalFuelCost.toFixed(0)
      ]));
    });
    this.autoFitColumns(summarySheet);

    // ===== الورقة 2: كل المأموريات (لكل السائقين) =====
    const missionSheet = this.createArabicWorksheet(workbook, 'المأموريات');
    const missionHeaderRow = missionSheet.addRow(['السائق', 'رقم المأمورية', 'تاريخ البداية', 'تاريخ النهاية', 'رقم السيارة', 'عداد الخروج', 'عداد الدخول', 'المسافة', 'الجهة', 'الحالة']);
    this.styleHeaderRow(missionHeaderRow);
    reports.forEach((r: any) => {
      (r.missions || []).forEach((m: any) => {
        this.styleDataRow(missionSheet.addRow([
          r.driver.fullName || '-',
          m.missionNumber || m.orderNumber || '',
          m.startDate ? new Date(m.startDate).toLocaleDateString('ar-EG') : '',
          m.endDate ? new Date(m.endDate).toLocaleDateString('ar-EG') : '',
          m.plateNumber || m.vehicleId || '',
          m.startKM || 0,
          m.endKM || 0,
          m.totalKM || (m.endKM || 0) - (m.startKM || 0) || 0,
          m.entityName || '',
          m.status || ''
        ]));
      });
    });
    this.autoFitColumns(missionSheet);

    // ===== الورقة 3: كل الإيجارات =====
    const rentalSheet = this.createArabicWorksheet(workbook, 'الإيجارات');
    const rentalHeaderRow = rentalSheet.addRow(['السائق', 'رقم أمر الشغل', 'تاريخ البداية', 'تاريخ النهاية', 'الجهة', 'رقم السيارة', 'القيمة', 'الحالة']);
    this.styleHeaderRow(rentalHeaderRow);
    reports.forEach((r: any) => {
      (r.rentals || []).forEach((rt: any) => {
        this.styleDataRow(rentalSheet.addRow([
          r.driver.fullName || '-',
          rt.orderNumber || rt.rentalNumber || '',
          rt.startDate ? new Date(rt.startDate).toLocaleDateString('ar-EG') : '',
          rt.endDate ? new Date(rt.endDate).toLocaleDateString('ar-EG') : '',
          rt.entityName || rt.renterName || '',
          rt.plateNumber || rt.vehicleId || '',
          rt.totalPrice || rt.rentalValue || 0,
          rt.status || ''
        ]));
      });
    });
    this.autoFitColumns(rentalSheet);

    // ===== الورقة 4: كل الحوادث =====
    const accidentSheet = this.createArabicWorksheet(workbook, 'الحوادث');
    const accidentHeaderRow = accidentSheet.addRow(['السائق', 'رقم الحادث', 'التاريخ', 'رقم السيارة', 'الموقع', 'الوصف', 'الخطورة', 'التكلفة', 'الحالة']);
    this.styleHeaderRow(accidentHeaderRow);
    reports.forEach((r: any) => {
      (r.accidents || []).forEach((a: any) => {
        this.styleDataRow(accidentSheet.addRow([
          r.driver.fullName || '-',
          a.accidentNumber || '',
          a.accidentDate ? new Date(a.accidentDate).toLocaleDateString('ar-EG') : '',
          a.plateNumber || a.vehicleId || '',
          a.location || '',
          a.description || '',
          a.severity || '',
          a.estimatedCost || 0,
          a.status || ''
        ]));
      });
    });
    this.autoFitColumns(accidentSheet);

    // ===== الورقة 5: كل المخالفات =====
    const violationSheet = this.createArabicWorksheet(workbook, 'المخالفات');
    const violationHeaderRow = violationSheet.addRow(['السائق', 'رقم المخالفة', 'التاريخ', 'رقم السيارة', 'الموقع', 'النوع', 'الوصف', 'الغرامة', 'حالة الدفع', 'الحالة']);
    this.styleHeaderRow(violationHeaderRow);
    reports.forEach((r: any) => {
      (r.violations || []).forEach((v: any) => {
        this.styleDataRow(violationSheet.addRow([
          r.driver.fullName || '-',
          v.violationNumber || '',
          v.violationDate ? new Date(v.violationDate).toLocaleDateString('ar-EG') : '',
          v.plateNumber || v.vehicleId || '',
          v.location || '',
          v.type || '',
          v.description || '',
          v.fineAmount || 0,
          v.paymentStatus || '',
          v.status || ''
        ]));
      });
    });
    this.autoFitColumns(violationSheet);

    // ===== الورقة 6: كل عمليات التموين =====
    const fuelSheet = this.createArabicWorksheet(workbook, 'التموين');
    const fuelHeaderRow = fuelSheet.addRow(['السائق', 'التاريخ', 'رقم السيارة', 'الكمية (لتر)', 'التكلفة']);
    this.styleHeaderRow(fuelHeaderRow);
    reports.forEach((r: any) => {
      (r.fuel || []).forEach((f: any) => {
        const rawDate = f.date || f.createdAt;
        this.styleDataRow(fuelSheet.addRow([
          r.driver.fullName || '-',
          rawDate ? new Date(rawDate).toLocaleDateString('ar-EG') : '',
          f.plateNumber || f.vehicleId || '',
          f.fuelQuantity || 0,
          f.totalCost || 0
        ]));
      });
    });
    this.autoFitColumns(fuelSheet);

    // حفظ الملف
    const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `تقرير_شامل_للسائقين_${Date.now()}.xlsx`;
    const filePath = path.join(uploadDir, filename);
    await workbook.xlsx.writeFile(filePath);

    logger.info(`✅ All-drivers full report exported: ${filePath} (${reports.length} سائق)`);
    return filePath;
  }

  // ============================================================
  // ===== حساب حالة رخصة السائق تلقائيًا بناءً على تاريخ الانتهاء =====
  // (نفس منطق العدّاد الموجود في صفحة السائقين على الفرونت إند)
  // ============================================================


  // ============================================================
  // ✅ تقرير السائقين (إيجارات) مع فلتر من / إلى
  // مجمّع حسب الفئة: داخلي (200ج/يوم) - خارجي (300ج/يوم) - مبيت (200ج/ليلة)
  // ============================================================

  // ✅ الأسعار الرسمية الثابتة للفئتين (نفس القيم المطبوعة في النموذج الورقي)
  private static readonly RATE_INTERNAL = 200;
  private static readonly RATE_EXTERNAL = 300;
  private static readonly RATE_OVERNIGHT = 200;

  /**
   * فئة الإيجار — بطريقة آمنة لا تخمّن:
   * 1) لو الحقل rentalCategory موجود صراحةً بيُستخدم.
   * 2) لو مش موجود، بيتقارن السعر المُدخل بالسعرين الرسميين **بالتطابق التام**
   *    (200 = داخلي، 300 = خارجي) — ده بيغطي الإيجارات القديمة اللي فعلاً
   *    كانت بنفس الأسعار الرسمية ومفيش شك في تصنيفها.
   * 3) أي سعر تاني (أو سعر مفقود) بيترجع 'unspecified' — ومبيتحطش في
   *    عمود داخلي أو خارجي بالغلط. تقرير السائقين بيعرضها في عمود منفصل
   *    "غير مصنّف" بسعرها الفعلي المُسجَّل، وسكريبت
   *    modules/rentals/scripts/backfill-rental-category.ts بيطلعلك قائمة
   *    بيهم عشان تحددهم يدوياً.
   */
  private resolveRentalCategory(rt: any): 'internal' | 'external' | 'unspecified' {
    const cat = String(rt?.rentalCategory || '').toLowerCase();
    if (cat === 'internal') return 'internal';
    if (cat === 'external') return 'external';

    const price = Number(rt?.unitPrice ?? rt?.rentalValue ?? NaN);
    if (price === ReportsService.RATE_INTERNAL) return 'internal';
    if (price === ReportsService.RATE_EXTERNAL) return 'external';
    return 'unspecified';
  }

  /**
   * بيانات تقرير السائقين مجمّعة حسب الفئة خلال فترة
   */
  async getDriversRentalSummaryReport(filters?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<any> {
    const RATE_INTERNAL = ReportsService.RATE_INTERNAL;
    const RATE_EXTERNAL = ReportsService.RATE_EXTERNAL;
    const RATE_OVERNIGHT = ReportsService.RATE_OVERNIGHT;

    const drivers = (await this.driverRepo?.findAll({ filter: { isDeleted: { $ne: true } } })) || [];
    const rentals = (await this.rentalRepo?.findAll({ filter: { isDeleted: { $ne: true } } })) || [];

    // فلترة الإيجارات بالفترة (من / إلى) على تاريخ البداية
    const from = filters?.dateFrom ? new Date(filters.dateFrom) : null;
    const to = filters?.dateTo ? new Date(filters.dateTo) : null;
    if (to) to.setHours(23, 59, 59, 999);

    const inRange = (rentals as any[]).filter((rt: any) => {
      const d = rt.startDate ? new Date(rt.startDate) : null;
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });

    // تجميع حسب السائق
    const rows: any[] = [];
    let anyUnspecified = false;

    (drivers as any[]).forEach((d: any) => {
      const driverRentals = inRange.filter(
        (rt: any) => String(rt.driverId) === String(d.id) || rt.driverName === d.fullName
      );
      if (driverRentals.length === 0) return;

      let internalDays = 0, externalDays = 0, overnightDays = 0;
      // ✅ الإيجارات اللي مش واضح تصنيفها — بتُحسب بسعرها الفعلي المُسجَّل
      //    (مش بسعر ثابت مفترض) وتتحط في عمود منفصل بدل ما تتخمّن
      let unspecifiedDays = 0, unspecifiedTotal = 0, unspecifiedCount = 0;

      driverRentals.forEach((rt: any) => {
        // عدد الأيام: من الحقل أو محسوب من تاريخي البداية والنهاية
        let days = Number(rt.days || 0);
        if (!days && rt.startDate && rt.endDate) {
          const diff = new Date(rt.endDate).getTime() - new Date(rt.startDate).getTime();
          days = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }
        if (!days) days = 1;

        const category = this.resolveRentalCategory(rt);
        if (category === 'external') {
          externalDays += days;
        } else if (category === 'internal') {
          internalDays += days;
        } else {
          // غير مصنّف: نحسبه بسعره الفعلي بدل ما نخمّن فئته
          const ownPrice = Number(rt.unitPrice ?? rt.rentalValue ?? 0);
          unspecifiedDays += days;
          unspecifiedTotal += ownPrice * days;
          unspecifiedCount += 1;
          anyUnspecified = true;
        }

        // ليالي المبيت
        overnightDays += Number(rt.overnight || rt.overnightNights || 0);
      });

      const internalTotal = internalDays * RATE_INTERNAL;
      const externalTotal = externalDays * RATE_EXTERNAL;
      const overnightTotal = overnightDays * RATE_OVERNIGHT;

      rows.push({
        driverName: d.fullName || '-',
        internalDays, internalTotal,
        externalDays, externalTotal,
        overnightDays, overnightTotal,
        unspecifiedDays, unspecifiedTotal, unspecifiedCount,
        grandTotal: internalTotal + externalTotal + overnightTotal + unspecifiedTotal,
      });
    });

    const totals = rows.reduce(
      (acc: any, r: any) => ({
        internalDays: acc.internalDays + r.internalDays,
        internalTotal: acc.internalTotal + r.internalTotal,
        externalDays: acc.externalDays + r.externalDays,
        externalTotal: acc.externalTotal + r.externalTotal,
        overnightDays: acc.overnightDays + r.overnightDays,
        overnightTotal: acc.overnightTotal + r.overnightTotal,
        unspecifiedDays: acc.unspecifiedDays + r.unspecifiedDays,
        unspecifiedTotal: acc.unspecifiedTotal + r.unspecifiedTotal,
        unspecifiedCount: acc.unspecifiedCount + r.unspecifiedCount,
        grandTotal: acc.grandTotal + r.grandTotal,
      }),
      {
        internalDays: 0, internalTotal: 0, externalDays: 0, externalTotal: 0,
        overnightDays: 0, overnightTotal: 0,
        unspecifiedDays: 0, unspecifiedTotal: 0, unspecifiedCount: 0,
        grandTotal: 0,
      }
    );

    return { rows, totals, anyUnspecified, dateFrom: filters?.dateFrom, dateTo: filters?.dateTo };
  }

  /**
   * تصدير تقرير السائقين إلى Excel بنفس تنسيق النموذج الورقي
   */
  async getDriversRentalSummaryReportExcel(filters?: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<string> {
    const { rows, totals, anyUnspecified } = await this.getDriversRentalSummaryReport(filters);

    // عدد الأعمدة الثابتة (السائق + داخلي×2 + خارجي×2 + مبيت×2 + الإجمالي) = 8
    // + عمود "غير مصنّف" (يومين) لو فيه إيجارات قديمة سعرها مش معروف = 10
    const colCount = anyUnspecified ? 10 : 8;

    const workbook = new ExcelJS.Workbook();
    const sheet = this.createArabicWorksheet(workbook, 'تقرير السائقين');

    // ===== العنوان + الفترة =====
    const titleRow = sheet.addRow(['مستحقات الموظفين بالسيارات الملاكي']);
    sheet.mergeCells(titleRow.number, 1, titleRow.number, colCount);
    titleRow.getCell(1).font = { bold: true, size: 16 };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 28;

    const periodText =
      filters?.dateFrom || filters?.dateTo
        ? `من ${filters?.dateFrom || '...'} إلى ${filters?.dateTo || '...'}`
        : 'كل الفترات';
    const periodRow = sheet.addRow([periodText]);
    sheet.mergeCells(periodRow.number, 1, periodRow.number, colCount);
    periodRow.getCell(1).font = { bold: true, size: 12 };
    periodRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // ✅ تنويه صريح عند وجود إيجارات قديمة غير واضحة الفئة — لا تصنيف صامت
    if (anyUnspecified) {
      const warnRow = sheet.addRow([
        '⚠ يوجد إيجارات قديمة سعرها لا يطابق السعرين الرسميين (200/300) فظهرت في عمود "غير مصنّف" بسعرها الفعلي بدل تخمين فئتها. ' +
        'شغّل سكريبت backfill-rental-category.ts لمراجعتها وتحديد فئتها يدوياً.',
      ]);
      sheet.mergeCells(warnRow.number, 1, warnRow.number, colCount);
      warnRow.getCell(1).font = { size: 10, italic: true, color: { argb: 'FFB45309' } };
      warnRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
    sheet.addRow([]);

    // ===== صف الهيدر المدمج (مجموعات) =====
    const groupHeaderCells = [
      'السائق',
      'داخلي (200 ج لليوم)', '',
      'خارجي (300 ج لليوم)', '',
      'مبيت (200 ج لليلة)', '',
    ];
    if (anyUnspecified) groupHeaderCells.push('غير مصنّف (بسعره الفعلي)', '');
    groupHeaderCells.push('الإجمالي');

    const groupRow = sheet.addRow(groupHeaderCells);
    sheet.mergeCells(groupRow.number, 2, groupRow.number, 3);
    sheet.mergeCells(groupRow.number, 4, groupRow.number, 5);
    sheet.mergeCells(groupRow.number, 6, groupRow.number, 7);
    if (anyUnspecified) {
      sheet.mergeCells(groupRow.number, 8, groupRow.number, 9);
    }
    // دمج رأسي لعمودي السائق والإجمالي
    sheet.mergeCells(groupRow.number, 1, groupRow.number + 1, 1);
    sheet.mergeCells(groupRow.number, colCount, groupRow.number + 1, colCount);
    this.styleHeaderRow(groupRow);

    const subRowCells = ['', 'عدد الأيام', 'الإجمالي', 'عدد الأيام', 'الإجمالي', 'عدد الأيام', 'الإجمالي'];
    if (anyUnspecified) subRowCells.push('عدد الأيام', 'الإجمالي');
    subRowCells.push('');
    const subRow = sheet.addRow(subRowCells);
    this.styleHeaderRow(subRow);

    // ===== الصفوف =====
    const dash = (v: number) => (v ? v : '-');
    const money = (v: number) => (v ? `${v.toLocaleString()} ج` : '-');

    rows.forEach((r: any) => {
      const rowCells = [
        r.driverName,
        dash(r.internalDays), money(r.internalTotal),
        dash(r.externalDays), money(r.externalTotal),
        dash(r.overnightDays), money(r.overnightTotal),
      ];
      if (anyUnspecified) rowCells.push(dash(r.unspecifiedDays), money(r.unspecifiedTotal));
      rowCells.push(money(r.grandTotal));
      this.styleDataRow(sheet.addRow(rowCells));
    });

    // ===== صف الإجمالي =====
    const totalCells = [
      'الإجمالي',
      totals.internalDays, `${totals.internalTotal.toLocaleString()} جنيه`,
      totals.externalDays, `${totals.externalTotal.toLocaleString()} جنيه`,
      totals.overnightDays, `${totals.overnightTotal.toLocaleString()} جنيه`,
    ];
    if (anyUnspecified) totalCells.push(totals.unspecifiedDays, `${totals.unspecifiedTotal.toLocaleString()} جنيه`);
    totalCells.push(`${totals.grandTotal.toLocaleString()} جنيه`);

    const totalRow = sheet.addRow(totalCells);
    this.styleDataRow(totalRow);
    totalRow.eachCell((cell) => {
      cell.font = { bold: true, size: 12 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    });

    this.autoFitColumns(sheet);

    const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `تقرير_سائقين_${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    logger.info(
      `✅ Drivers rental summary report exported: ${filePath}` +
      (anyUnspecified ? ' (يحتوي على إيجارات غير مصنّفة — راجع backfill-rental-category.ts)' : '')
    );
    return filePath;
  }

  // ============================================================
  // ✅ تقرير استهلاك الكروت + شيت إجمالي الوقود
  // فلتر: من / إلى + رقم السيارة
  // ============================================================

  async getFuelCardsConsumptionReportExcel(filters?: {
    dateFrom?: string;
    dateTo?: string;
    vehicleId?: string;
    plateNumber?: string;
  }): Promise<string> {
    const logs: any[] = ((await this.fuelLogRepo?.findAll({
      filter: { isDeleted: { $ne: true } },
      sort: { transactionDate: 'desc', date: 'desc' },
    })) || []) as any[];

    const vehicles: any[] = ((await this.vehicleRepo?.findAll({ filter: { isDeleted: { $ne: true } } })) || []) as any[];
    const vehicleMap = new Map<string, any>();
    vehicles.forEach((v: any) => vehicleMap.set(String(v.id), v));

    // فلترة
    const from = filters?.dateFrom ? new Date(filters.dateFrom) : null;
    const to = filters?.dateTo ? new Date(filters.dateTo) : null;
    if (to) to.setHours(23, 59, 59, 999);

    const filtered = logs.filter((l: any) => {
      const raw = l.transactionDate || l.date || l.createdAt;
      const d = raw ? new Date(raw) : null;
      if (from && (!d || d < from)) return false;
      if (to && (!d || d > to)) return false;
      if (filters?.vehicleId && String(l.vehicleId) !== String(filters.vehicleId)) return false;
      if (filters?.plateNumber) {
        const plate = l.plateNumber || vehicleMap.get(String(l.vehicleId))?.plateNumber || '';
        if (!String(plate).includes(filters.plateNumber)) return false;
      }
      return true;
    });

    const workbook = new ExcelJS.Workbook();

    // ===== الشيت 1: تقرير استهلاك الكروت =====
    const sheet = this.createArabicWorksheet(workbook, 'استهلاك الكروت');

    const titleRow = sheet.addRow(['تقرير استهلاك الكروت']);
    sheet.mergeCells(titleRow.number, 1, titleRow.number, 14);
    titleRow.getCell(1).font = { bold: true, size: 16 };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 28;

    const periodRow = sheet.addRow([
      filters?.dateFrom || filters?.dateTo
        ? `من ${filters?.dateFrom || '...'} إلى ${filters?.dateTo || '...'}`
        : 'كل الفترات',
    ]);
    sheet.mergeCells(periodRow.number, 1, periodRow.number, 14);
    periodRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    periodRow.getCell(1).font = { bold: true, size: 12 };
    sheet.addRow([]);

    const headerRow = sheet.addRow([
      'م',
      'كمية المصروف',
      'قيمة المصروف',
      'عدد اللترات',
      'اسم المحطة',
      'كود المحطة',
      'رقم الكارت',
      'رقم التذكرة',
      'تاريخ حركة الكارت',
      'اسم المنتج',
      'العداد',
      'المسافة المقطوعة',
      'معدل الاستهلاك',
      'رقم اللوحة',
    ]);
    this.styleHeaderRow(headerRow);

    filtered.forEach((l: any, i: number) => {
      const v = vehicleMap.get(String(l.vehicleId));
      const rawDate = l.transactionDate || l.date || l.createdAt;
      this.styleDataRow(
        sheet.addRow([
          i + 1,
          Number(l.expenseQuantity || l.fuelQuantity || 0).toFixed(2),
          Number(l.expenseAmount || l.totalCost || 0).toFixed(2),
          Number(l.fuelQuantity || 0).toFixed(2),
          l.stationName || '',
          l.stationCode || '',
          l.cardNumber || v?.fuelCardNumber || '',
          l.ticketNumber || '',
          rawDate ? new Date(rawDate).toLocaleString('ar-EG') : '',
          l.productName || l.fuelType || '',
          Number(l.currentKM || 0),
          Number(l.distanceTraveled || l.distanceSinceLastFuel || 0),
          l.consumptionRate ? `${l.consumptionRate} كم/لتر` : '-',
          l.plateNumber || v?.plateNumber || '',
        ])
      );
    });

    // صف الإجمالي
    const sumQty = filtered.reduce((s: number, l: any) => s + Number(l.fuelQuantity || 0), 0);
    const sumCost = filtered.reduce((s: number, l: any) => s + Number(l.expenseAmount || l.totalCost || 0), 0);
    const grandRow = sheet.addRow([
      'الإجمالي', sumQty.toFixed(2), sumCost.toFixed(2), sumQty.toFixed(2),
      '', '', '', '', '', '', '', '', '', '',
    ]);
    this.styleDataRow(grandRow);
    grandRow.eachCell((c) => {
      c.font = { bold: true, size: 12 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    });
    this.autoFitColumns(sheet);

    // ===== الشيت 2: تقرير إجمالي وقود =====
    const totalSheet = this.createArabicWorksheet(workbook, 'تقرير إجمالي وقود');

    const tTitle = totalSheet.addRow(['تقرير إجمالي وقود']);
    totalSheet.mergeCells(tTitle.number, 1, tTitle.number, 4);
    tTitle.getCell(1).font = { bold: true, size: 16 };
    tTitle.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    tTitle.height = 28;

    const tPeriod = totalSheet.addRow([
      filters?.dateFrom || filters?.dateTo
        ? `من ${filters?.dateFrom || '...'} إلى ${filters?.dateTo || '...'}`
        : 'كل الفترات',
    ]);
    totalSheet.mergeCells(tPeriod.number, 1, tPeriod.number, 4);
    tPeriod.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    tPeriod.getCell(1).font = { bold: true, size: 12 };
    totalSheet.addRow([]);

    const tHeader = totalSheet.addRow(['نوع الوقود', 'عدد اللترات', 'السعر (ج.م)', 'الإجمالي (ج.م)']);
    this.styleHeaderRow(tHeader);

    const fuelTypeLabels: Record<string, string> = {
      petrol_92: 'بنزين 92',
      petrol_95: 'بنزين 95',
      diesel: 'سولار',
      electric: 'كهرباء',
    };

    // تجميع حسب نوع الوقود
    const byType = new Map<string, { litres: number; cost: number }>();
    filtered.forEach((l: any) => {
      const key = l.fuelType || l.productName || 'غير محدد';
      const cur = byType.get(key) || { litres: 0, cost: 0 };
      cur.litres += Number(l.fuelQuantity || 0);
      cur.cost += Number(l.expenseAmount || l.totalCost || 0);
      byType.set(key, cur);
    });

    let totLitres = 0, totCost = 0;
    byType.forEach((val, key) => {
      totLitres += val.litres;
      totCost += val.cost;
      const avgPrice = val.litres > 0 ? val.cost / val.litres : 0;
      this.styleDataRow(
        totalSheet.addRow([
          fuelTypeLabels[key] || key,
          val.litres.toFixed(2),
          avgPrice.toFixed(2),
          val.cost.toFixed(2),
        ])
      );
    });

    const tTotalRow = totalSheet.addRow([
      'الإجمالي',
      totLitres.toFixed(2),
      '',
      `${totCost.toLocaleString()} جنيه`,
    ]);
    this.styleDataRow(tTotalRow);
    tTotalRow.eachCell((c) => {
      c.font = { bold: true, size: 12 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    });
    this.autoFitColumns(totalSheet);

    const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `تقرير_استهلاك_كروت_${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    logger.info(`✅ Fuel cards consumption report exported: ${filePath}`);
    return filePath;
  }

  private computeDriverLicenseStatus(licenseExpiry?: string): string {
    if (!licenseExpiry) return 'سارية';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(licenseExpiry);
    expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (expiry < today) return 'منتهية';
    if (diffDays <= 30) return 'على وشك الانتهاء';
    return 'سارية';
  }

  // ============================================================
  // ===== تقارير الصيانة =====
  // ============================================================

  async generateMaintenanceReport(startDate: string, endDate: string, plateNumber?: string): Promise<any> {
    if (!this.maintenanceRepo) {
      throw new AppError('Maintenance repository not initialized', 500);
    }

    let orders = await this.maintenanceRepo.findAll({
      filter: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    });

    // ✅ فلتر رقم العربية
    if (plateNumber) {
      const vehicles = (await this.vehicleRepo?.findAll({ filter: { isDeleted: { $ne: true } } })) || [];
      const matching = new Set(
        (vehicles as any[])
          .filter((v: any) => String(v.plateNumber || '').includes(plateNumber))
          .map((v: any) => String(v.id))
      );
      orders = orders.filter(
        (o: any) => matching.has(String(o.vehicleId)) || String(o.plateNumber || '').includes(plateNumber)
      );
    }

    logger.info(`📊 Found ${orders.length} maintenance orders for period ${startDate} to ${endDate}`);

    const totalOrders = orders.length;
    const completed = orders.filter(o => o.status === 'completed').length;
    const inProgress = orders.filter(o => o.status === 'in_progress').length;
    const pending = orders.filter(o => o.status === 'scheduled' || o.status === 'pending_parts').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;

    const totalCost = orders.reduce((sum, o) => sum + (o.totalCost || 0), 0);
    const totalLaborCost = orders.reduce((sum, o) => sum + (o.laborCost || 0), 0);
    const totalPartsCost = orders.reduce((sum, o) => sum + (o.partsCost || 0), 0);

    const result = {
      summary: {
        totalOrders,
        completed,
        inProgress,
        pending,
        cancelled,
        totalCost,
        totalLaborCost,
        totalPartsCost,
        averageCost: totalOrders > 0 ? totalCost / totalOrders : 0,
      },
      details: orders.map(order => ({
        orderNumber: order.orderNumber || 'N/A',
        vehicleId: (order as any).plateNumber || order.vehicleId || 'N/A',
        problem: order.problemDescription || 'N/A',
        startDate: order.startDate || 'N/A',
        endDate: order.endDate
          || (order as any).completedAt
          || (order as any).completionDate
          || (order as any).actualEndDate
          || (order as any).finishedAt
          || (order.status === 'completed' ? (order as any).updatedAt : null)
          || 'N/A',
        status: order.status || 'N/A',
        laborCost: order.laborCost || 0,
        partsCost: order.partsCost || 0,
        totalCost: order.totalCost || 0,
        partsUsed: order.partsUsed || [],
        partsNeeded: order.partsNeeded || [],
      })),
    };

    return result;
  }

  async getMaintenanceReportExcel(startDate: string, endDate: string, plateNumber?: string): Promise<string> {
    const data = await this.generateMaintenanceReport(startDate, endDate, plateNumber);
    const headers = ['orderNumber', 'vehicleId', 'problem', 'startDate', 'endDate', 'status', 'laborCost', 'partsCost', 'totalCost'];
    const arabicHeaders = ['رقم طلب الإصلاح', 'رقم السيارة', 'المشكلة', 'تاريخ البداية', 'تاريخ النهاية', 'الحالة', 'تكلفة العمالة', 'تكلفة قطع الغيار', 'الإجمالي'];
    const mapped = (data.details || []).map((d: any) => {
      const row: any = {};
      headers.forEach((h, i) => (row[arabicHeaders[i]] = d[h]));
      return row;
    });
    return this.exportToExcel({ details: mapped }, `تقرير_الصيانة_${Date.now()}.xlsx`, arabicHeaders, 'تقرير الصيانة');
  }

  async getMaintenanceReportPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.generateMaintenanceReport(startDate, endDate);
    return this.exportToPDF(data, `maintenance_report_${Date.now()}.pdf`, 'تقرير الصيانة الشامل');
  }

  // ============================================================
  // ===== تقرير استهلاك قطع الغيار =====
  // ============================================================

  async generatePartsConsumptionReport(startDate: string, endDate: string): Promise<any> {
    if (!this.transactionRepo || !this.partRepo) {
      throw new AppError('Inventory repositories not initialized', 500);
    }

    const transactions = await this.transactionRepo.findAll({
      filter: {
        transactionType: 'issue',
        createdAt: { $gte: startDate, $lte: endDate },
      },
    });

    const partsMap: Record<string, any> = {};

    for (const trans of transactions) {
      const partId = trans.partId;
      if (!partsMap[partId]) {
        const part = await this.partRepo.findById(partId);
        partsMap[partId] = {
          partId: partId,
          partName: part?.name || 'غير معروف',
          partCode: part?.code || '',
          totalQuantity: 0,
          totalCost: 0,
          usedIn: [],
        };
      }
      partsMap[partId].totalQuantity += trans.quantity;
      partsMap[partId].totalCost += (trans.quantity || 0) * (trans.unitPrice || 0);
      partsMap[partId].usedIn.push({
        date: trans.createdAt,
        quantity: trans.quantity,
        reference: trans.referenceId,
        type: trans.referenceType,
      });
    }

    return {
      summary: {
        totalParts: Object.keys(partsMap).length,
        totalQuantityUsed: Object.values(partsMap).reduce((sum: number, p: any) => sum + p.totalQuantity, 0),
        totalCost: Object.values(partsMap).reduce((sum: number, p: any) => sum + p.totalCost, 0),
      },
      details: Object.values(partsMap),
    };
  }

  async getPartsReportExcel(startDate: string, endDate: string): Promise<string> {
    const data = await this.generatePartsConsumptionReport(startDate, endDate);
    const headers = ['partName', 'partCode', 'totalQuantity', 'totalCost'];
    const arabicHeaders = ['اسم القطعة', 'كود القطعة', 'إجمالي الكمية المستخدمة', 'إجمالي التكلفة'];
    const mapped = (data.details || []).map((d: any) => {
      const row: any = {};
      headers.forEach((h, i) => (row[arabicHeaders[i]] = d[h]));
      return row;
    });
    return this.exportToExcel({ details: mapped }, `تقرير_قطع_الغيار_${Date.now()}.xlsx`, arabicHeaders, 'استهلاك قطع الغيار');
  }

  async getPartsReportPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.generatePartsConsumptionReport(startDate, endDate);
    return this.exportToPDF(data, `parts_report_${Date.now()}.pdf`, 'تقرير استهلاك قطع الغيار');
  }

  // ============================================================
  // ===== تقرير تكاليف الصيانة =====
  // ============================================================

  async generateMaintenanceCostReport(startDate: string, endDate: string): Promise<any> {
    if (!this.maintenanceRepo) {
      throw new AppError('Maintenance repository not initialized', 500);
    }

    const orders = await this.maintenanceRepo.findAll({
      filter: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate },
      },
    });

    const vehicleMap: Record<string, any> = {};

    for (const order of orders) {
      const vehicleId = order.vehicleId;
      if (!vehicleMap[vehicleId]) {
        vehicleMap[vehicleId] = {
          vehicleId: vehicleId,
          totalOrders: 0,
          totalLaborCost: 0,
          totalPartsCost: 0,
          totalCost: 0,
          orders: [],
        };
      }
      vehicleMap[vehicleId].totalOrders += 1;
      vehicleMap[vehicleId].totalLaborCost += order.laborCost || 0;
      vehicleMap[vehicleId].totalPartsCost += order.partsCost || 0;
      vehicleMap[vehicleId].totalCost += order.totalCost || 0;
      vehicleMap[vehicleId].orders.push({
        orderNumber: order.orderNumber,
        date: order.startDate,
        laborCost: order.laborCost,
        partsCost: order.partsCost,
        totalCost: order.totalCost,
      });
    }

    return {
      summary: {
        totalOrders: orders.length,
        totalCost: orders.reduce((sum, o) => sum + (o.totalCost || 0), 0),
        averageCost: orders.length > 0 ? orders.reduce((sum, o) => sum + (o.totalCost || 0), 0) / orders.length : 0,
      },
      vehicles: Object.values(vehicleMap),
    };
  }

  async getCostReportExcel(startDate: string, endDate: string): Promise<string> {
    const data = await this.generateMaintenanceCostReport(startDate, endDate);
    const headers = ['vehicleId', 'totalOrders', 'totalLaborCost', 'totalPartsCost', 'totalCost'];
    const arabicHeaders = ['رقم السيارة', 'عدد أوامر الصيانة', 'تكلفة العمالة', 'تكلفة قطع الغيار', 'الإجمالي'];
    const mapped = (data.vehicles || []).map((d: any) => {
      const row: any = {};
      headers.forEach((h, i) => (row[arabicHeaders[i]] = d[h]));
      return row;
    });
    return this.exportToExcel({ details: mapped }, `تقرير_تكاليف_الصيانة_${Date.now()}.xlsx`, arabicHeaders, 'تكاليف الصيانة');
  }

  async getCostReportPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.generateMaintenanceCostReport(startDate, endDate);
    return this.exportToPDF(data, `cost_report_${Date.now()}.pdf`, 'تقرير تكاليف الصيانة');
  }

  // ============================================================
  // ===== تقرير شامل =====
  // ============================================================

  async generateFullReport(startDate: string, endDate: string): Promise<any> {
    const maintenanceReport = await this.generateMaintenanceReport(startDate, endDate);
    const partsReport = await this.generatePartsConsumptionReport(startDate, endDate);
    const costReport = await this.generateMaintenanceCostReport(startDate, endDate);

    return {
      period: { startDate, endDate },
      generatedAt: new Date().toISOString(),
      maintenance: maintenanceReport,
      parts: partsReport,
      costs: costReport,
    };
  }

  async getFullReportExcel(startDate: string, endDate: string): Promise<string> {
    const data = await this.generateFullReport(startDate, endDate);
    return this.exportToExcel(data, `تقرير_شامل_${Date.now()}.xlsx`, undefined, 'تقرير شامل');
  }

  async getFullReportPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.generateFullReport(startDate, endDate);
    return this.exportToPDF(data, `full_report_${Date.now()}.pdf`, 'تقرير شامل');
  }

  // ============================================================
  // ===== التقارير المتقدمة =====
  // ============================================================

  // 1. تقرير المصروفات
  async getExpensesReport(startDate: string, endDate: string): Promise<any> {
    let fuelCost = 0;
    let fuelLogs: any[] = [];
    if (this.fuelLogRepo) {
      fuelLogs = await this.fuelLogRepo.findAll({
        filter: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      }) || [];
      fuelCost = fuelLogs.reduce((sum, f) => sum + (f.totalCost || 0), 0);
    }

    let maintenanceCost = 0;
    let maintenanceOrders: any[] = [];
    if (this.maintenanceRepo) {
      maintenanceOrders = await this.maintenanceRepo.findAll({
        filter: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      }) || [];
      maintenanceCost = maintenanceOrders.reduce((sum, o) => sum + (o.totalCost || 0), 0);
    }

    let partsCost = 0;
    let partsTransactions: any[] = [];
    if (this.transactionRepo) {
      partsTransactions = await this.transactionRepo.findAll({
        filter: {
          transactionType: 'issue',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      }) || [];
      partsCost = partsTransactions.reduce((sum, t) => sum + ((t.quantity || 0) * (t.unitPrice || 0)), 0);
    }

    let purchaseCost = 0;
    let purchaseOrders: any[] = [];
    if (this.purchaseRepo) {
      purchaseOrders = await this.purchaseRepo.findAll({
        filter: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      }) || [];
      purchaseCost = purchaseOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    }

    const totalExpenses = fuelCost + maintenanceCost + partsCost + purchaseCost;

    return {
      summary: {
        fuelCost,
        maintenanceCost,
        partsCost,
        purchaseCost,
        totalExpenses,
      },
      details: {
        fuelLogs: fuelLogs.length,
        maintenanceOrders: maintenanceOrders.length,
        partsTransactions: partsTransactions.length,
        purchaseOrders: purchaseOrders.length,
      },
    };
  }

  async getExpensesReportExcel(startDate: string, endDate: string): Promise<string> {
    const data = await this.getExpensesReport(startDate, endDate);
    const row = {
      'تكلفة الوقود': data.summary.fuelCost,
      'تكلفة الصيانة': data.summary.maintenanceCost,
      'تكلفة قطع الغيار': data.summary.partsCost,
      'تكلفة المشتريات': data.summary.purchaseCost,
      'إجمالي المصروفات': data.summary.totalExpenses,
    };
    const headers = Object.keys(row);
    return this.exportToExcel({ details: [row] }, `تقرير_المصروفات_${Date.now()}.xlsx`, headers, 'تقرير المصروفات');
  }

  async getExpensesReportPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.getExpensesReport(startDate, endDate);
    return this.exportToPDF(data, `expenses_report_${Date.now()}.pdf`, 'تقرير المصروفات');
  }

  // 2. تقرير السيارات الأعلى تكلفة
  async getTopCostVehicles(startDate: string, endDate: string, limit: number = 10): Promise<any> {
    const maintenanceOrders = await this.maintenanceRepo?.findAll({
      filter: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    }) || [];

    const fuelLogs = await this.fuelLogRepo?.findAll({
      filter: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    }) || [];

    const vehicleCosts: Record<string, any> = {};

    for (const order of maintenanceOrders) {
      const vehicleId = order.vehicleId;
      if (!vehicleCosts[vehicleId]) {
        const vehicle = await this.vehicleRepo?.findById(vehicleId);
        vehicleCosts[vehicleId] = {
          vehicleId,
          vehiclePlate: vehicle?.plateNumber || 'غير محدد',
          maintenanceCost: 0,
          fuelCost: 0,
          partsCost: 0,
          totalCost: 0,
          maintenanceCount: 0,
          fuelCount: 0,
        };
      }
      vehicleCosts[vehicleId].maintenanceCost += order.totalCost || 0;
      vehicleCosts[vehicleId].partsCost += order.partsCost || 0;
      vehicleCosts[vehicleId].maintenanceCount += 1;
      vehicleCosts[vehicleId].totalCost += order.totalCost || 0;
    }

    for (const fuel of fuelLogs) {
      const vehicleId = fuel.vehicleId;
      if (!vehicleCosts[vehicleId]) {
        const vehicle = await this.vehicleRepo?.findById(vehicleId);
        vehicleCosts[vehicleId] = {
          vehicleId,
          vehiclePlate: vehicle?.plateNumber || 'غير محدد',
          maintenanceCost: 0,
          fuelCost: 0,
          partsCost: 0,
          totalCost: 0,
          maintenanceCount: 0,
          fuelCount: 0,
        };
      }
      vehicleCosts[vehicleId].fuelCost += fuel.totalCost || 0;
      vehicleCosts[vehicleId].fuelCount += 1;
      vehicleCosts[vehicleId].totalCost += fuel.totalCost || 0;
    }

    const sorted = Object.values(vehicleCosts).sort((a, b) => b.totalCost - a.totalCost);

    const details = sorted.slice(0, limit).map(v => ({
      'رقم السيارة': v.vehiclePlate || 'غير محدد',
      'تكلفة الصيانة': v.maintenanceCost || 0,
      'تكلفة الوقود': v.fuelCost || 0,
      'تكلفة قطع الغيار': v.partsCost || 0,
      'الإجمالي': v.totalCost || 0,
    }));

    return {
      summary: {
        'إجمالي السيارات': Object.keys(vehicleCosts).length,
        'إجمالي التكلفة': sorted.reduce((sum, v) => sum + v.totalCost, 0),
      },
      details: details,
    };
  }

  async getTopCostVehiclesExcel(startDate: string, endDate: string): Promise<string> {
    const data = await this.getTopCostVehicles(startDate, endDate);
    const headers = ['رقم السيارة', 'تكلفة الصيانة', 'تكلفة الوقود', 'تكلفة قطع الغيار', 'الإجمالي'];
    return this.exportToExcel(data, `السيارات_الأعلى_تكلفة_${Date.now()}.xlsx`, headers, 'السيارات الأعلى تكلفة');
  }

  async getTopCostVehiclesPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.getTopCostVehicles(startDate, endDate);
    return this.exportToPDF(data, `top_cost_vehicles_${Date.now()}.pdf`, 'السيارات الأعلى تكلفة');
  }

  // 3. تقرير الأعطال المتكررة
  async getFrequentIssuesReport(startDate: string, endDate: string): Promise<any> {
    const maintenanceOrders = await this.maintenanceRepo?.findAll({
      filter: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    }) || [];

    const issuesMap: Record<string, any> = {};

    for (const order of maintenanceOrders) {
      const description = order.problemDescription || '';
      const keywords = description.split(' ');
      for (const keyword of keywords) {
        if (keyword.length > 3) {
          const key = keyword.toLowerCase();
          if (!issuesMap[key]) {
            issuesMap[key] = {
              keyword: key,
              count: 0,
              orders: [],
              totalCost: 0,
              vehicles: new Set(),
            };
          }
          issuesMap[key].count += 1;
          issuesMap[key].orders.push(order.orderNumber);
          issuesMap[key].totalCost += order.totalCost || 0;
          if (order.vehicleId) {
            issuesMap[key].vehicles.add(order.vehicleId);
          }
        }
      }
    }

    const sorted = Object.values(issuesMap)
      .map((item: any) => ({
        ...item,
        vehicles: Array.from(item.vehicles),
        vehicleCount: item.vehicles.size,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      summary: {
        totalIssues: sorted.length,
        totalOrders: maintenanceOrders.length,
      },
      details: sorted.slice(0, 20),
    };
  }

  async getFrequentIssuesExcel(startDate: string, endDate: string): Promise<string> {
    const data = await this.getFrequentIssuesReport(startDate, endDate);
    const headers = ['keyword', 'count', 'totalCost', 'vehicleCount'];
    const arabicHeaders = ['الكلمة الدالة', 'عدد التكرار', 'إجمالي التكلفة', 'عدد السيارات المتأثرة'];
    const mapped = (data.details || []).map((d: any) => {
      const row: any = {};
      headers.forEach((h, i) => (row[arabicHeaders[i]] = d[h]));
      return row;
    });
    return this.exportToExcel({ details: mapped }, `الأعطال_المتكررة_${Date.now()}.xlsx`, arabicHeaders, 'الأعطال المتكررة');
  }

  async getFrequentIssuesPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.getFrequentIssuesReport(startDate, endDate);
    return this.exportToPDF(data, `frequent_issues_${Date.now()}.pdf`, 'الأعطال المتكررة');
  }

  // 4. تقرير السيارات الأعلى استهلاكاً للوقود
  async getTopFuelConsumptionVehicles(startDate: string, endDate: string, limit: number = 10): Promise<any> {
    const fuelLogs = await this.fuelLogRepo?.findAll({
      filter: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    }) || [];

    const vehicleFuel: Record<string, any> = {};

    for (const fuel of fuelLogs) {
      const vehicleId = fuel.vehicleId;
      if (!vehicleFuel[vehicleId]) {
        const vehicle = await this.vehicleRepo?.findById(vehicleId);
        vehicleFuel[vehicleId] = {
          vehicleId,
          vehiclePlate: vehicle?.plateNumber || 'غير محدد',
          totalFuel: 0,
          totalCost: 0,
          totalKM: 0,
          count: 0,
          avgConsumption: 0,
          fuelType: vehicle?.fuelType || 'غير محدد',
        };
      }
      vehicleFuel[vehicleId].totalFuel += fuel.fuelQuantity || 0;
      vehicleFuel[vehicleId].totalCost += fuel.totalCost || 0;
      vehicleFuel[vehicleId].totalKM += fuel.distanceSinceLastFuel || 0;
      vehicleFuel[vehicleId].count += 1;
    }

    for (const key of Object.keys(vehicleFuel)) {
      const v = vehicleFuel[key];
      v.avgConsumption = v.totalKM > 0 ? v.totalFuel / v.totalKM : 0;
    }

    const sorted = Object.values(vehicleFuel).sort((a, b) => b.totalFuel - a.totalFuel);

    const details = sorted.slice(0, limit).map(v => ({
      'رقم السيارة': v.vehiclePlate || 'غير محدد',
      'إجمالي الوقود (لتر)': v.totalFuel || 0,
      'إجمالي التكلفة': v.totalCost || 0,
      'المسافة (كم)': v.totalKM || 0,
      'متوسط الاستهلاك (لتر/كم)': v.avgConsumption || 0,
      'عدد مرات التعبئة': v.count || 0,
    }));

    return {
      summary: {
        'إجمالي السيارات': Object.keys(vehicleFuel).length,
        'إجمالي الوقود المستهلك': sorted.reduce((sum, v) => sum + v.totalFuel, 0),
        'إجمالي التكلفة': sorted.reduce((sum, v) => sum + v.totalCost, 0),
      },
      details: details,
    };
  }

  async getTopFuelConsumptionExcel(startDate: string, endDate: string): Promise<string> {
    const data = await this.getTopFuelConsumptionVehicles(startDate, endDate);
    const headers = ['رقم السيارة', 'إجمالي الوقود (لتر)', 'إجمالي التكلفة', 'المسافة (كم)', 'متوسط الاستهلاك (لتر/كم)', 'عدد مرات التعبئة'];
    return this.exportToExcel(data, `السيارات_الأعلى_استهلاكاً_للوقود_${Date.now()}.xlsx`, headers, 'الأعلى استهلاكاً للوقود');
  }

  async getTopFuelConsumptionPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.getTopFuelConsumptionVehicles(startDate, endDate);
    return this.exportToPDF(data, `top_fuel_consumption_${Date.now()}.pdf`, 'السيارات الأعلى استهلاكاً للوقود');
  }

  // ============================================================
  // ===== تقرير الوقود =====
  // ============================================================

  async getFuelReport(startDate: string, endDate: string): Promise<any> {
    if (!this.fuelLogRepo) {
      throw new AppError('Fuel log repository not initialized', 500);
    }

    const fuelLogs = await this.fuelLogRepo.findAll({
      filter: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    }) || [];

    const totalQuantity = fuelLogs.reduce((sum, f) => sum + (f.fuelQuantity || 0), 0);
    const totalCost = fuelLogs.reduce((sum, f) => sum + (f.totalCost || 0), 0);
    const totalKM = fuelLogs.reduce((sum, f) => sum + (f.distanceSinceLastFuel || 0), 0);

    return {
      summary: {
        totalLogs: fuelLogs.length,
        totalQuantity,
        totalCost,
        totalKM,
        averageConsumption: totalKM > 0 ? totalQuantity / totalKM : 0,
      },
      details: fuelLogs.map((f: any) => ({
        date: f.createdAt || '',
        vehicleId: f.vehicleId || '',
        quantity: f.fuelQuantity || 0,
        cost: f.totalCost || 0,
        distance: f.distanceSinceLastFuel || 0,
      })),
    };
  }

  async getFuelReportExcel(startDate: string, endDate: string): Promise<string> {
    const data = await this.getFuelReport(startDate, endDate);
    const headers = ['date', 'vehicleId', 'quantity', 'cost', 'distance'];
    const arabicHeaders = ['التاريخ', 'رقم السيارة', 'الكمية (لتر)', 'التكلفة', 'المسافة (كم)'];
    const mapped = (data.details || []).map((d: any) => {
      const row: any = {};
      headers.forEach((h, i) => (row[arabicHeaders[i]] = d[h]));
      return row;
    });
    return this.exportToExcel({ details: mapped }, `تقرير_الوقود_${Date.now()}.xlsx`, arabicHeaders, 'تقرير الوقود');
  }

  async getFuelReportPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.getFuelReport(startDate, endDate);
    return this.exportToPDF(data, `fuel_report_${Date.now()}.pdf`, 'تقرير الوقود');
  }

  // ============================================================
  // ===== تقرير السيارات =====
  // ============================================================

  async getVehiclesReport(startDate: string, endDate: string): Promise<any> {
    if (!this.vehicleRepo) {
      throw new AppError('Vehicle repository not initialized', 500);
    }

    const vehicles = await this.vehicleRepo.findAll() || [];

    return {
      summary: {
        totalVehicles: vehicles.length,
      },
      details: vehicles.map((v: any) => ({
        plateNumber: v.plateNumber || '',
        vehicleType: v.vehicleType || '',
        brand: v.brand || '',
        manufactureYear: v.manufactureYear || '',
        color: v.color || '',
        chassisNumber: v.chassisNumber || '',
        engineNumber: v.engineNumber || '',
        fuelCardNumber: v.fuelCardNumber || '',
        standardFuelConsumption: v.standardFuelConsumption || '',
        assignedTo: v.assignedTo || '',
        licenseStatus: v.licenseStatus || '',
        licenseExpiry: v.licenseExpiry || '',
        status: v.status || '',
      })),
    };
  }

  async getVehiclesReportExcel(startDate: string, endDate: string): Promise<string> {
    const data = await this.getVehiclesReport(startDate, endDate);
    const headers = ['plateNumber', 'vehicleType', 'brand', 'manufactureYear', 'color', 'chassisNumber', 'engineNumber', 'fuelCardNumber', 'standardFuelConsumption', 'assignedTo', 'licenseStatus', 'licenseExpiry', 'status'];
    const arabicHeaders = ['رقم اللوحة', 'نوع السيارة', 'الموديل', 'سنة الصنع', 'اللون', 'رقم الشاسيه', 'رقم الماتور', 'رقم الكارت', 'المعدل القياسي للاستهلاك', 'صاحب العهدة', 'حالة الرخصة', 'انتهاء الترخيص', 'الحالة'];
    const mapped = (data.details || []).map((d: any) => {
      const row: any = {};
      headers.forEach((h, i) => (row[arabicHeaders[i]] = d[h]));
      return row;
    });
    return this.exportToExcel({ details: mapped }, `تقرير_السيارات_${Date.now()}.xlsx`, arabicHeaders, 'تقرير السيارات');
  }

  async getVehiclesReportPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.getVehiclesReport(startDate, endDate);
    return this.exportToPDF(data, `vehicles_report_${Date.now()}.pdf`, 'تقرير السيارات');
  }

  // ============================================================
  // ===== تقرير المأموريات =====
  // ============================================================

  async getMissionsReport(startDate: string, endDate: string): Promise<any> {
    if (!this.missionRepo) {
      throw new AppError('Mission repository not initialized', 500);
    }

    const missions = await this.missionRepo.findAll({
      filter: {
        startDate: { $gte: startDate, $lte: endDate },
      },
    }) || [];

    return {
      summary: {
        totalMissions: missions.length,
      },
      details: missions.map((m: any) => ({
        orderNumber: m.orderNumber || '',
        vehicleId: m.vehicleId || '',
        driverName: m.driverName || '',
        startDate: m.startDate || '',
        endDate: m.endDate || '',
        destination: m.destination || m.route || '',
        status: m.status || '',
        startKM: m.startKM || 0,
        endKM: m.endKM || 0,
        totalKM: (m.endKM || 0) - (m.startKM || 0),
      })),
    };
  }

  async getMissionsReportExcel(startDate: string, endDate: string): Promise<string> {
    const data = await this.getMissionsReport(startDate, endDate);
    const headers = ['orderNumber', 'vehicleId', 'driverName', 'startDate', 'endDate', 'destination', 'status', 'startKM', 'endKM', 'totalKM'];
    const arabicHeaders = ['رقم أمر الشغل', 'رقم السيارة', 'اسم السائق', 'تاريخ البداية', 'تاريخ النهاية', 'الوجهة', 'الحالة', 'عداد الخروج', 'عداد الدخول', 'المسافة المقطوعة'];
    const mapped = (data.details || []).map((d: any) => {
      const row: any = {};
      headers.forEach((h, i) => (row[arabicHeaders[i]] = d[h]));
      return row;
    });
    return this.exportToExcel({ details: mapped }, `تقرير_المأموريات_${Date.now()}.xlsx`, arabicHeaders, 'تقرير المأموريات');
  }

  async getMissionsReportPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.getMissionsReport(startDate, endDate);
    return this.exportToPDF(data, `missions_report_${Date.now()}.pdf`, 'تقرير المأموريات');
  }

  // ============================================================
  // ===== تقرير المخزون =====
  // ============================================================

  async getInventoryReport(startDate: string, endDate: string): Promise<any> {
    if (!this.partRepo || !this.transactionRepo) {
      throw new AppError('Inventory repositories not initialized', 500);
    }

    const parts = await this.partRepo.findAll() || [];
    const transactions = await this.transactionRepo.findAll({
      filter: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    }) || [];

    return {
      summary: {
        totalParts: parts.length,
        totalTransactions: transactions.length,
      },
      details: parts.map((p: any) => ({
        code: p.code || '',
        name: p.name || '',
        currentStock: p.currentStock || 0,
        minimumStock: p.minimumStock || 0,
        unitPrice: p.unitPrice || 0,
        totalValue: (p.currentStock || 0) * (p.unitPrice || 0),
      })),
    };
  }

  async getInventoryReportExcel(startDate: string, endDate: string): Promise<string> {
    const data = await this.getInventoryReport(startDate, endDate);
    const headers = ['code', 'name', 'currentStock', 'minimumStock', 'unitPrice', 'totalValue'];
    const arabicHeaders = ['الكود', 'اسم الصنف', 'الرصيد الحالي', 'الحد الأدنى', 'سعر الوحدة', 'القيمة الإجمالية'];
    const mapped = (data.details || []).map((d: any) => {
      const row: any = {};
      headers.forEach((h, i) => (row[arabicHeaders[i]] = d[h]));
      return row;
    });
    return this.exportToExcel({ details: mapped }, `تقرير_المخزون_${Date.now()}.xlsx`, arabicHeaders, 'تقرير المخزون');
  }

  async getInventoryReportPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.getInventoryReport(startDate, endDate);
    return this.exportToPDF(data, `inventory_report_${Date.now()}.pdf`, 'تقرير المخزون');
  }

  // ============================================================
  // ===== تقرير المشتريات =====
  // ============================================================

  async getPurchasingReport(startDate: string, endDate: string): Promise<any> {
    if (!this.purchaseRepo) {
      throw new AppError('Purchase repository not initialized', 500);
    }

    const orders = await this.purchaseRepo.findAll({
      filter: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    }) || [];

    const totalAmount = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      summary: {
        totalOrders: orders.length,
        totalAmount,
      },
      details: orders.map((o: any) => ({
        orderNumber: o.orderNumber || '',
        supplier: o.supplierName || o.supplier || '',
        date: o.createdAt || '',
        total: o.total || 0,
        status: o.status || '',
      })),
    };
  }

  async getPurchasingReportExcel(startDate: string, endDate: string): Promise<string> {
    const data = await this.getPurchasingReport(startDate, endDate);
    const headers = ['orderNumber', 'supplier', 'date', 'total', 'status'];
    const arabicHeaders = ['رقم أمر الشراء', 'المورد', 'التاريخ', 'الإجمالي', 'الحالة'];
    const mapped = (data.details || []).map((d: any) => {
      const row: any = {};
      headers.forEach((h, i) => (row[arabicHeaders[i]] = d[h]));
      return row;
    });
    return this.exportToExcel({ details: mapped }, `تقرير_المشتريات_${Date.now()}.xlsx`, arabicHeaders, 'تقرير المشتريات');
  }

  async getPurchasingReportPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.getPurchasingReport(startDate, endDate);
    return this.exportToPDF(data, `purchasing_report_${Date.now()}.pdf`, 'تقرير المشتريات');
  }

  // ============================================================
  // ===== تقارير المركبات (Fleet Reports - No Date) =====
  // ============================================================

  // 1. تقرير الأتوبيس - ميني باص - ميكروباص
  async getBusReport(): Promise<any[]> {
    if (!this.vehicleRepo) {
      throw new AppError('Vehicle repository not initialized', 500);
    }

    const vehicles = await this.vehicleRepo.findAll() || [];

    const busTypes = ['اتوبيس', 'مينى باص', 'ميكروباص', 'نيسان ميكروباص', 'ميني باص'];
    const busVehicles = vehicles.filter(v =>
      busTypes.some(type => (v['vehicleType'] || '').includes(type))
    );

    return busVehicles.map((v: any) => ({
      'اسم البيان': v['vehicleType'] || '',
      'نوع البيان': v['bodyType'] || '',
      'الموديل': v['brand'] || '',
      'رقم العربة': v['plateNumber'] || '',
      'سنة الصنع': v['manufactureYear'] || '',
      'رقم الشاسية': v['chassisNumber'] || '',
      'رقم الماتور': v['engineNumber'] || '',
      'حالة الرخصة': v['licenseStatus'] || '',
      'انتهاء الترخيص': v['licenseExpiry'] || '',
      'اللون': v['color'] || '',
      'الحمولة المدونة ': v['capacity'] || v['passengerCount'] || '',
      'نوع الوقود': v['fuelType'] || '',
      'مكان تواجد العربة': v['location'] || v['garage'] || '',
      'عدد الخطوط لكل مركبة': v['linesCount'] || v['operation'] || v['assignedTo'] || '',
      'نسبة الصلاحية الفنية': v['technicalRating'] || '',
      'الحالة الفنية للمركبة': v['technicalCondition'] || '',
      'نوع الاصلاح': v['repairType'] || '',
      'نسبة اصلاح العطل': v['repairPercentage'] || '',
      'ملاحظات': v['notes'] || '',
    }));
  }

  async getBusReportExcel(): Promise<string> {
    const data = await this.getBusReport();
    const headers = [
      'اسم البيان', 'نوع البيان', 'الموديل', 'رقم العربة', 'سنة الصنع',
      'رقم الشاسية', 'رقم الماتور', 'حالة الرخصة', 'انتهاء الترخيص', 'اللون',
      'الحمولة المدونة ', 'نوع الوقود', 'مكان تواجد العربة', 'عدد الخطوط لكل مركبة',
      'نسبة الصلاحية الفنية', 'الحالة الفنية للمركبة', 'نوع الاصلاح',
      'نسبة اصلاح العطل', 'ملاحظات'
    ];
    return this.exportToExcel(data, `أتوبيس_ميني_باص_ميكروباص_${Date.now()}.xlsx`, headers, 'المركبات');
  }

  async getBusReportPDF(): Promise<string> {
    const data = await this.getBusReport();
    return this.exportToPDF(data, `أتوبيس_ميني_باص_ميكروباص_${Date.now()}.pdf`, 'تقرير الأتوبيس - ميني باص - ميكروباص');
  }

  // 2. تقرير البيك اب - النقل - اللوري
  async getTruckReport(): Promise<any[]> {
    if (!this.vehicleRepo) {
      throw new AppError('Vehicle repository not initialized', 500);
    }

    const vehicles = await this.vehicleRepo.findAll() || [];

    const truckTypes = ['بيك اب', 'لوري', 'نقل', 'بيك اب مزدوج', 'بيك اب مذدوج'];
    const truckVehicles = vehicles.filter(v =>
      truckTypes.some(type => (v['vehicleType'] || '').includes(type))
    );

    return truckVehicles.map((v: any) => ({
      'اسم البيان': v['vehicleType'] || '',
      'نوع البيان': v['bodyType'] || '',
      'الموديل': v['brand'] || '',
      'رقم العربة': v['plateNumber'] || '',
      'سنة الصنع': v['manufactureYear'] || '',
      'رقم الشاسية': v['chassisNumber'] || '',
      'رقم الماتور': v['engineNumber'] || '',
      'حالة الرخصة': v['licenseStatus'] || '',
      'انتهاء الترخيص': v['licenseExpiry'] || '',
      'اللون': v['color'] || '',
      'الحمولة المدونة ': v['capacity'] || v['loadCapacity'] || '',
      'نوع الوقود': v['fuelType'] || '',
      'مكان تواجد العربة': v['location'] || v['garage'] || '',
      'عدد الخطوط لكل مركبة': v['linesCount'] || v['operation'] || v['assignedTo'] || '',
      'نسبة الصلاحية الفنية': v['technicalRating'] || '',
      'الحالة الفنية للمركبة': v['technicalCondition'] || '',
      'نوع الاصلاح': v['repairType'] || '',
      'نسبة اصلاح العطل': v['repairPercentage'] || '',
      'ملاحظات': v['notes'] || '',
    }));
  }

  async getTruckReportExcel(): Promise<string> {
    const data = await this.getTruckReport();
    const headers = [
      'اسم البيان', 'نوع البيان', 'الموديل', 'رقم العربة', 'سنة الصنع',
      'رقم الشاسية', 'رقم الماتور', 'حالة الرخصة', 'انتهاء الترخيص', 'اللون',
      'الحمولة المدونة ', 'نوع الوقود', 'مكان تواجد العربة', 'عدد الخطوط لكل مركبة',
      'نسبة الصلاحية الفنية', 'الحالة الفنية للمركبة', 'نوع الاصلاح',
      'نسبة اصلاح العطل', 'ملاحظات'
    ];
    return this.exportToExcel(data, `بيك_اب_نقل_لوري_${Date.now()}.xlsx`, headers, 'المركبات');
  }

  async getTruckReportPDF(): Promise<string> {
    const data = await this.getTruckReport();
    return this.exportToPDF(data, `بيك_اب_نقل_لوري_${Date.now()}.pdf`, 'تقرير البيك اب - النقل - اللوري');
  }

  // 3. تقرير الملاكي
  async getPrivateReport(): Promise<any[]> {
    if (!this.vehicleRepo) {
      throw new AppError('Vehicle repository not initialized', 500);
    }

    const vehicles = await this.vehicleRepo.findAll() || [];

    const privateVehicles = vehicles.filter(v =>
      (v['vehicleType'] || '').includes('ملاكي')
    );

    return privateVehicles.map((v: any) => ({
      'اسم البيان': v['vehicleType'] || '',
      'نوع البيان': v['bodyType'] || '',
      'الموديل': v['brand'] || '',
      'رقم العربة': v['plateNumber'] || '',
      'سنة الصنع': v['manufactureYear'] || '',
      'رقم الشاسية': v['chassisNumber'] || '',
      'رقم الماتور': v['engineNumber'] || '',
      'حالة الرخصة': v['licenseStatus'] || '',
      'انتهاء الترخيص': v['licenseExpiry'] || '',
      'اللون': v['color'] || '',
      'الحمولة المدونة ': v['capacity'] || v['passengerCount'] || '',
      'نوع الوقود': v['fuelType'] || '',
      'مكان تواجد العربة': v['location'] || v['garage'] || '',
      'عدد الخطوط لكل مركبة': v['linesCount'] || v['operation'] || v['assignedTo'] || '',
      'نسبة الصلاحية الفنية': v['technicalRating'] || '',
      'الحالة الفنية للمركبة': v['technicalCondition'] || '',
      'نوع الاصلاح': v['repairType'] || '',
      'نسبة اصلاح العطل': v['repairPercentage'] || '',
      'ملاحظات': v['notes'] || '',
    }));
  }

  async getPrivateReportExcel(): Promise<string> {
    const data = await this.getPrivateReport();
    const headers = [
      'اسم البيان', 'نوع البيان', 'الموديل', 'رقم العربة', 'سنة الصنع',
      'رقم الشاسية', 'رقم الماتور', 'حالة الرخصة', 'انتهاء الترخيص', 'اللون',
      'الحمولة المدونة ', 'نوع الوقود', 'مكان تواجد العربة', 'عدد الخطوط لكل مركبة',
      'نسبة الصلاحية الفنية', 'الحالة الفنية للمركبة', 'نوع الاصلاح',
      'نسبة اصلاح العطل', 'ملاحظات'
    ];
    return this.exportToExcel(data, `الملاكي_${Date.now()}.xlsx`, headers, 'المركبات');
  }

  async getPrivateReportPDF(): Promise<string> {
    const data = await this.getPrivateReport();
    return this.exportToPDF(data, `الملاكي_${Date.now()}.pdf`, 'تقرير الملاكي');
  }

  // ============================================================
  // ===== تقرير الكروت (بطاقات الوقود) =====
  // ============================================================

  async getFuelCardsReport(): Promise<any[]> {
    if (!this.fuelCardRepo) {
      throw new AppError('Fuel card repository not initialized', 500);
    }

    const cards = await this.fuelCardRepo.findAll() || [];

    return cards.map((c, index) => ({
      'م': index + 1,
      'رقم اللوحه': c['plateNumber'] || c['vehicleId'] || '',
      'نوع المنتج': c['fuelType'] || 'بنزين 92',
      'نوع الكارت': c['cardType'] || 'مركبه',
      'رقم الكارت': c['cardNumber'] || '',
    }));
  }

  async getFuelCardsReportExcel(): Promise<string> {
    const data = await this.getFuelCardsReport();
    const headers = ['م', 'رقم اللوحه', 'نوع المنتج', 'نوع الكارت', 'رقم الكارت'];
    return this.exportToExcel(data, `كروت_الوقود_${Date.now()}.xlsx`, headers, 'كروت الوقود');
  }

  async getFuelCardsReportPDF(): Promise<string> {
    const data = await this.getFuelCardsReport();
    return this.exportToPDF(data, `كروت_الوقود_${Date.now()}.pdf`, 'تقرير كروت الوقود');
  }

  // ============================================================
  // ===== تقرير الإيجارات =====
  // ============================================================

  async getRentalsReport(startDate: string, endDate: string, plateNumber?: string): Promise<any[]> {
    if (!this.rentalRepo) {
      throw new AppError('Rental repository not initialized', 500);
    }

    let rentals = await this.rentalRepo.findAll({
      filter: {
        startDate: { $gte: startDate, $lte: endDate }
      }
    }) || [];

    // ✅ فلتر رقم السيارة
    if (plateNumber) {
      rentals = rentals.filter((r: any) =>
        String(r.plateNumber || '').includes(plateNumber) ||
        String(r.vehicleId || '') === plateNumber
      );
    }

    return rentals.map(r => ({
      'تاريخ بداية المأمورية': r['startDate'] || '',
      'تاريخ نهاية المأمورية': r['endDate'] || '',
      'الجهة': r['entityName'] || '',
      'وجهة السفر': r['destination'] || '',
      'نوع السيارة': r['vehicleType'] || '',
      'عدد الأيام': r['days'] || 1,
      'رقم أمر الشغل': r['orderNumber'] || '',
      'القيمة الايجارية': r['rentalValue'] || 0,
      // ✅ نفس منطق resolveRentalCategory — تطابق تام بالسعر بدل التخمين،
      // وأي حالة غير واضحة بتظهر "غير مصنّف" صراحةً بدل ما تتحط "داخلي" غلط
      'النوع': (() => {
        const c = this.resolveRentalCategory(r);
        return c === 'external' ? 'خارجي' : c === 'internal' ? 'داخلي' : 'غير مصنّف';
      })(),
      'المبيت': r['overnightTotal'] ?? r['overnight'] ?? 0,
      'بدل السائق': r['driverAllowance'] || 0,
      'الاجمالي': r['finalPrice'] ?? r['totalPrice'] ??
        ((r['rentalValue'] || 0) + (r['overnightTotal'] || 0) + (r['driverAllowance'] || 0)),
      'حساب الجهة': r['account'] || '',
      'بيانات السداد': r['paymentData'] || '',
      'السائق': r['driverName'] || '',
      'رقم السيارة': r['plateNumber'] || '',
    }));
  }

  /**
   * ✅ تقرير الإيجارات: شيت تفصيلي + شيت ملخص (الجهة / الحساب / الإجمالي)
   * فلاتر: من / إلى + رقم السيارة
   */
  async getRentalsReportExcel(
    startDate: string,
    endDate: string,
    plateNumber?: string
  ): Promise<string> {
    const data = await this.getRentalsReport(startDate, endDate, plateNumber);

    const headers = [
      'تاريخ بداية المأمورية', 'تاريخ نهاية المأمورية', 'الجهة', 'وجهة السفر',
      'نوع السيارة', 'النوع', 'عدد الأيام', 'رقم أمر التشغيل', 'القيمة الايجارية',
      'المبيت', 'بدل السائق', 'الاجمالي', 'حساب الجهة', 'بيانات السداد', 'السائق', 'رقم السيارة'
    ];

    const workbook = new ExcelJS.Workbook();

    // ===== الشيت 1: التفاصيل =====
    const sheet = this.createArabicWorksheet(workbook, 'الإيجارات');
    const titleRow = sheet.addRow(['تقرير الإيجارات']);
    sheet.mergeCells(titleRow.number, 1, titleRow.number, headers.length);
    titleRow.getCell(1).font = { bold: true, size: 16 };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 28;

    const periodRow = sheet.addRow([
      `من ${startDate} إلى ${endDate}` + (plateNumber ? ` | رقم السيارة: ${plateNumber}` : ''),
    ]);
    sheet.mergeCells(periodRow.number, 1, periodRow.number, headers.length);
    periodRow.getCell(1).font = { bold: true, size: 12 };
    periodRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.addRow([]);

    this.styleHeaderRow(sheet.addRow(headers));
    data.forEach((r: any) => {
      this.styleDataRow(sheet.addRow(headers.map((h) => r[h] ?? '')));
    });
    this.autoFitColumns(sheet);

    // ===== الشيت 2: الملخص (الجهة / الحساب / الإجمالي) =====
    const summarySheet = this.createArabicWorksheet(workbook, 'الملخص');
    const sTitle = summarySheet.addRow(['ملخص الإيجارات']);
    summarySheet.mergeCells(sTitle.number, 1, sTitle.number, 3);
    sTitle.getCell(1).font = { bold: true, size: 16 };
    sTitle.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    sTitle.height = 28;

    const sPeriod = summarySheet.addRow([`من ${startDate} إلى ${endDate}`]);
    summarySheet.mergeCells(sPeriod.number, 1, sPeriod.number, 3);
    sPeriod.getCell(1).font = { bold: true, size: 12 };
    sPeriod.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.addRow([]);

    this.styleHeaderRow(summarySheet.addRow(['الجهة', 'الحساب', 'الإجمالي']));

    // تجميع حسب الجهة + الحساب
    const grouped = new Map<string, { entity: string; account: string; total: number }>();
    data.forEach((r: any) => {
      const entity = r['الجهة'] || '-';
      const account = r['حساب الجهة'] || '-';
      const key = `${entity}||${account}`;
      const cur = grouped.get(key) || { entity, account, total: 0 };
      cur.total += Number(r['الاجمالي'] || 0);
      grouped.set(key, cur);
    });

    let grandTotal = 0;
    grouped.forEach((g) => {
      grandTotal += g.total;
      this.styleDataRow(summarySheet.addRow([g.entity, g.account, g.total.toLocaleString()]));
    });

    const gRow = summarySheet.addRow(['الإجمالي', '', `${grandTotal.toLocaleString()} جنيه`]);
    this.styleDataRow(gRow);
    gRow.eachCell((c) => {
      c.font = { bold: true, size: 12 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    });
    this.autoFitColumns(summarySheet);

    const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `الايجارات_${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    logger.info(`✅ Rentals report exported: ${filePath}`);
    return filePath;
  }

  async getRentalsReportPDF(startDate: string, endDate: string): Promise<string> {
    const data = await this.getRentalsReport(startDate, endDate);
    return this.exportToPDF(data, `الايجارات_${Date.now()}.pdf`, 'تقرير الإيجارات');
  }

  // ============================================================
  // ===== تقرير الحركة =====
  // ============================================================

  async getMovementReport(vehicleId: string, startDate: string, endDate: string): Promise<any> {
    if (!this.vehicleRepo || !this.missionRepo) {
      throw new AppError('Required repositories not initialized', 500);
    }

    const vehicle = await this.vehicleRepo.findById(vehicleId);
    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }

    const missions = await this.missionRepo.findAll({
      filter: {
        vehicleId: vehicleId,
        startDate: { $gte: startDate, $lte: endDate }
      }
    }) || [];

    const movements = missions.map((m, index) => ({
      'م': index + 1,
      'رقم أمر الشغل': m['orderNumber'] || '',
      'تاريخ الخروج': m['startDate'] || '',
      'تاريخ الدخول': m['endDate'] || '',
      'عداد الخروج': m['startKM'] || 0,
      'عداد الدخول': m['endKM'] || 0,
      'المسافة المقطوعة': (m['endKM'] || 0) - (m['startKM'] || 0),
      'ساعة الخروج': m['startTime'] || '',
      'ساعة الدخول': m['endTime'] || '',
      'اسم السائق': m['driverName'] || '',
      'خط السير': m['route'] || '',
      'الجهة الطالبة': m['entityName'] || '',
      'حالة المأمورية': m['status'] || '',
    }));

    return {
      vehicle: {
        'رقم المركبة': vehicle['plateNumber'] || '',
        'نوع المركبة': vehicle['vehicleType'] || '',
        'سنة الصنع': vehicle['manufactureYear'] || '',
        'رقم الشاسيه': vehicle['chassisNumber'] || '',
        'رقم الموتور': vehicle['engineNumber'] || '',
        'السعة': vehicle['engineCapacity'] || '',
        'عدد السلندرات': vehicle['cylinders'] || '',
        'سعة تنك الوقود': vehicle['tankCapacity'] || '',
        'عدد الركاب': vehicle['passengerCount'] || '',
        'اللون': vehicle['color'] || '',
        'صاحب العهدة': vehicle['assignedTo'] || '',
        'تاريخ الترخيص': vehicle['licenseDate'] || '',
      },
      movements: movements
    };
  }

  async getMovementReportExcel(vehicleId: string, startDate: string, endDate: string): Promise<string> {
    const data = await this.getMovementReport(vehicleId, startDate, endDate);

    const vehicleHeaders = [
      'رقم المركبة', 'نوع المركبة', 'سنة الصنع', 'رقم الشاسيه',
      'رقم الموتور', 'السعة', 'عدد السلندرات', 'سعة تنك الوقود',
      'عدد الركاب', 'اللون', 'صاحب العهدة', 'تاريخ الترخيص'
    ];

    const movementHeaders = [
      'م', 'رقم أمر الشغل', 'تاريخ الخروج', 'تاريخ الدخول',
      'عداد الخروج', 'عداد الدخول', 'المسافة المقطوعة',
      'ساعة الخروج', 'ساعة الدخول', 'اسم السائق',
      'خط السير', 'الجهة الطالبة', 'حالة المأمورية'
    ];

    const workbook = new ExcelJS.Workbook();
    const worksheet = this.createArabicWorksheet(workbook, 'تقرير الحركة');

    const titleRow = worksheet.addRow(['بيانات المركبة']);
    titleRow.font = { bold: true, size: 14 };
    worksheet.mergeCells(`A${worksheet.rowCount}:${String.fromCharCode(64 + vehicleHeaders.length)}${worksheet.rowCount}`);

    const vehicleHeaderRow = worksheet.addRow(vehicleHeaders);
    this.styleHeaderRow(vehicleHeaderRow);

    const vehicleDataRow = worksheet.addRow(vehicleHeaders.map(h => data.vehicle[h] || ''));
    this.styleDataRow(vehicleDataRow);

    worksheet.addRow([]);

    const movementTitle = worksheet.addRow(['الحركة']);
    movementTitle.font = { bold: true, size: 14 };
    worksheet.mergeCells(`A${worksheet.rowCount}:${String.fromCharCode(64 + movementHeaders.length)}${worksheet.rowCount}`);

    const movementHeaderRow = worksheet.addRow(movementHeaders);
    this.styleHeaderRow(movementHeaderRow);

    for (const movement of data.movements) {
      const row = worksheet.addRow(movementHeaders.map(h => movement[h] ?? ''));
      this.styleDataRow(row);
    }

    this.autoFitColumns(worksheet);

    const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, `الحركة_${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    logger.info(`✅ Excel report exported: ${filePath}`);
    return filePath;
  }

  async getMovementReportPDF(vehicleId: string, startDate: string, endDate: string): Promise<string> {
    const data = await this.getMovementReport(vehicleId, startDate, endDate);
    return this.exportToPDF(data, `الحركة_${Date.now()}.pdf`, `تقرير حركة المركبة ${data.vehicle['رقم المركبة']}`);
  }

  // ============================================================
  // ===== أدوات مساعدة لتنسيق الإكسيل =====
  // ============================================================

  private HEADER_FILL = 'FFF0EDED';
  private HEADER_FONT_COLOR = 'FF000000';
  private BORDER_COLOR = 'FFD9D9D9';

  private createArabicWorksheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
    const worksheet = workbook.addWorksheet(name, {
      views: [{ rightToLeft: true, showGridLines: true }],
    });
    return worksheet;
  }

  private styleHeaderRow(row: ExcelJS.Row): void {
    row.eachCell((cell) => {
      cell.font = { bold: true, size: 13, color: { argb: this.HEADER_FONT_COLOR } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: this.HEADER_FILL },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: this.BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: this.BORDER_COLOR } },
        left: { style: 'thin', color: { argb: this.BORDER_COLOR } },
        right: { style: 'thin', color: { argb: this.BORDER_COLOR } },
      };
    });
    row.height = 24;
  }

  private styleDataRow(row: ExcelJS.Row): void {
    row.eachCell((cell) => {
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.font = { size: 11 };
      cell.border = {
        top: { style: 'thin', color: { argb: this.BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: this.BORDER_COLOR } },
        left: { style: 'thin', color: { argb: this.BORDER_COLOR } },
        right: { style: 'thin', color: { argb: this.BORDER_COLOR } },
      };
    });
  }

  private autoFitColumns(worksheet: ExcelJS.Worksheet): void {
    worksheet.columns.forEach((col: any) => {
      let maxLen = 12;
      (col.values || []).forEach((val: any) => {
        const len = String(val || '').length;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(45, Math.max(14, maxLen + 2));
    });
  }

  // ============================================================
  // ===== التقرير الشامل المجمّع (كل التقارير في ملف Excel واحد) =====
  // ============================================================
  // ملف Excel واحد فيه:
  //  - شيت "الفهرس": قائمة بكل التقارير + عدد السجلات + رابط للشيت
  //  - شيت لكل تقرير بنفس أعمدته حرفيًا (نفس تقارير صفحة التقارير)
  //  - في آخر كل شيت صف "الإجمالي" فيه مجموع كل عمود رقمي (SUM حي)
  // ملحوظة: تقارير "الأعلى تكلفة" و"الأعلى استهلاكًا" بتتجاب هنا كاملة
  // (من غير حد الـ 10 بتاع التقرير المنفرد).

  private async buildAllReportsSections(
    startDate: string,
    endDate: string
  ): Promise<
    Array<{
      sheetName: string;
      title: string;
      headers: string[];
      rows: any[];
      sumColumns: string[];
      customTotals?: (rows: any[]) => Record<string, number>;
      error?: string;
    }>
  > {
    type Section = {
      sheetName: string;
      title: string;
      headers: string[];
      rows: any[];
      sumColumns: string[];
      customTotals?: (rows: any[]) => Record<string, number>;
      error?: string;
    };
    const sections: Section[] = [];

    // يحوّل details (مفاتيح إنجليزي) لصفوف بعناوين عربي
    const mapRows = (details: any[], keys: string[], arabic: string[]): any[] =>
      (details || []).map((d: any) => {
        const row: any = {};
        keys.forEach((k, i) => (row[arabic[i]] = d?.[k]));
        return row;
      });

    // لو تقرير فشل ما نوقّفش باقي الملف — بنسجّل الخطأ في الفهرس
    const add = async (
      sheetName: string,
      title: string,
      headers: string[],
      sumColumns: string[],
      build: () => Promise<any[]>,
      customTotals?: (rows: any[]) => Record<string, number>
    ): Promise<void> => {
      try {
        const rows = await build();
        sections.push({ sheetName, title, headers, rows: rows || [], sumColumns, customTotals });
      } catch (error: any) {
        logger.error(`Error building "${title}" for comprehensive report:`, error);
        sections.push({
          sheetName,
          title,
          headers,
          rows: [],
          sumColumns,
          error: error?.message || 'تعذر تحميل هذا التقرير',
        });
      }
    };

    const ALL = Number.MAX_SAFE_INTEGER;

    // 1) الصيانة
    await add(
      'الصيانة', 'تقرير الصيانة',
      ['رقم طلب الإصلاح', 'رقم السيارة', 'المشكلة', 'تاريخ البداية', 'تاريخ النهاية', 'الحالة', 'تكلفة العمالة', 'تكلفة قطع الغيار', 'الإجمالي'],
      ['تكلفة العمالة', 'تكلفة قطع الغيار', 'الإجمالي'],
      async () => {
        const data = await this.generateMaintenanceReport(startDate, endDate);
        return mapRows(
          data.details,
          ['orderNumber', 'vehicleId', 'problem', 'startDate', 'endDate', 'status', 'laborCost', 'partsCost', 'totalCost'],
          ['رقم طلب الإصلاح', 'رقم السيارة', 'المشكلة', 'تاريخ البداية', 'تاريخ النهاية', 'الحالة', 'تكلفة العمالة', 'تكلفة قطع الغيار', 'الإجمالي']
        );
      }
    );

    // 2) استهلاك قطع الغيار
    await add(
      'قطع الغيار', 'تقرير استهلاك قطع الغيار',
      ['اسم القطعة', 'كود القطعة', 'إجمالي الكمية المستخدمة', 'إجمالي التكلفة'],
      ['إجمالي الكمية المستخدمة', 'إجمالي التكلفة'],
      async () => {
        const data = await this.generatePartsConsumptionReport(startDate, endDate);
        return mapRows(
          data.details,
          ['partName', 'partCode', 'totalQuantity', 'totalCost'],
          ['اسم القطعة', 'كود القطعة', 'إجمالي الكمية المستخدمة', 'إجمالي التكلفة']
        );
      }
    );

    // 3) تكاليف الصيانة
    await add(
      'تكاليف الصيانة', 'تقرير تكاليف الصيانة',
      ['رقم السيارة', 'عدد أوامر الصيانة', 'تكلفة العمالة', 'تكلفة قطع الغيار', 'الإجمالي'],
      ['عدد أوامر الصيانة', 'تكلفة العمالة', 'تكلفة قطع الغيار', 'الإجمالي'],
      async () => {
        const data = await this.generateMaintenanceCostReport(startDate, endDate);
        return mapRows(
          data.vehicles,
          ['vehicleId', 'totalOrders', 'totalLaborCost', 'totalPartsCost', 'totalCost'],
          ['رقم السيارة', 'عدد أوامر الصيانة', 'تكلفة العمالة', 'تكلفة قطع الغيار', 'الإجمالي']
        );
      }
    );

    // 4) المصروفات
    await add(
      'المصروفات', 'تقرير المصروفات',
      ['تكلفة الوقود', 'تكلفة الصيانة', 'تكلفة قطع الغيار', 'تكلفة المشتريات', 'إجمالي المصروفات', 'عدد سجلات الوقود', 'عدد أوامر الصيانة', 'عدد حركات قطع الغيار', 'عدد أوامر الشراء'],
      ['تكلفة الوقود', 'تكلفة الصيانة', 'تكلفة قطع الغيار', 'تكلفة المشتريات', 'إجمالي المصروفات', 'عدد سجلات الوقود', 'عدد أوامر الصيانة', 'عدد حركات قطع الغيار', 'عدد أوامر الشراء'],
      async () => {
        const data = await this.getExpensesReport(startDate, endDate);
        return [
          {
            'تكلفة الوقود': data.summary.fuelCost,
            'تكلفة الصيانة': data.summary.maintenanceCost,
            'تكلفة قطع الغيار': data.summary.partsCost,
            'تكلفة المشتريات': data.summary.purchaseCost,
            'إجمالي المصروفات': data.summary.totalExpenses,
            'عدد سجلات الوقود': data.details.fuelLogs,
            'عدد أوامر الصيانة': data.details.maintenanceOrders,
            'عدد حركات قطع الغيار': data.details.partsTransactions,
            'عدد أوامر الشراء': data.details.purchaseOrders,
          },
        ];
      }
    );

    // 5) السيارات الأعلى تكلفة (كاملة)
    await add(
      'الأعلى تكلفة', 'السيارات الأعلى تكلفة',
      ['رقم السيارة', 'تكلفة الصيانة', 'تكلفة الوقود', 'تكلفة قطع الغيار', 'الإجمالي'],
      ['تكلفة الصيانة', 'تكلفة الوقود', 'تكلفة قطع الغيار', 'الإجمالي'],
      async () => (await this.getTopCostVehicles(startDate, endDate, ALL)).details
    );

    // 6) الأعطال المتكررة
    await add(
      'الأعطال المتكررة', 'الأعطال المتكررة',
      ['الكلمة الدالة', 'عدد التكرار', 'إجمالي التكلفة', 'عدد السيارات المتأثرة'],
      ['عدد التكرار', 'إجمالي التكلفة', 'عدد السيارات المتأثرة'],
      async () => {
        const data = await this.getFrequentIssuesReport(startDate, endDate);
        return mapRows(
          data.details,
          ['keyword', 'count', 'totalCost', 'vehicleCount'],
          ['الكلمة الدالة', 'عدد التكرار', 'إجمالي التكلفة', 'عدد السيارات المتأثرة']
        );
      }
    );

    // 7) السيارات الأعلى استهلاكًا للوقود (كاملة)
    await add(
      'الأعلى استهلاكا للوقود', 'السيارات الأعلى استهلاكاً للوقود',
      ['رقم السيارة', 'إجمالي الوقود (لتر)', 'إجمالي التكلفة', 'المسافة (كم)', 'متوسط الاستهلاك (لتر/كم)', 'عدد مرات التعبئة'],
      ['إجمالي الوقود (لتر)', 'إجمالي التكلفة', 'المسافة (كم)', 'عدد مرات التعبئة'],
      async () => (await this.getTopFuelConsumptionVehicles(startDate, endDate, ALL)).details,
      // المتوسط مالوش معنى يتجمع، فبنحسبه من الإجماليات: إجمالي اللترات ÷ إجمالي الكيلومترات
      (rows) => {
        const liters = rows.reduce((s, r) => s + (Number(r['إجمالي الوقود (لتر)']) || 0), 0);
        const km = rows.reduce((s, r) => s + (Number(r['المسافة (كم)']) || 0), 0);
        return { 'متوسط الاستهلاك (لتر/كم)': km > 0 ? liters / km : 0 };
      }
    );

    // 8) الوقود
    await add(
      'الوقود', 'تقرير الوقود',
      ['التاريخ', 'رقم السيارة', 'الكمية (لتر)', 'التكلفة', 'المسافة (كم)'],
      ['الكمية (لتر)', 'التكلفة', 'المسافة (كم)'],
      async () => {
        const data = await this.getFuelReport(startDate, endDate);
        return mapRows(
          data.details,
          ['date', 'vehicleId', 'quantity', 'cost', 'distance'],
          ['التاريخ', 'رقم السيارة', 'الكمية (لتر)', 'التكلفة', 'المسافة (كم)']
        );
      }
    );

    // 9) السيارات
    await add(
      'السيارات', 'تقرير السيارات',
      ['رقم اللوحة', 'نوع السيارة', 'الموديل', 'سنة الصنع', 'اللون', 'رقم الشاسيه', 'رقم الماتور', 'رقم الكارت', 'المعدل القياسي للاستهلاك', 'صاحب العهدة', 'حالة الرخصة', 'انتهاء الترخيص', 'الحالة'],
      [],
      async () => {
        const data = await this.getVehiclesReport(startDate, endDate);
        return mapRows(
          data.details,
          ['plateNumber', 'vehicleType', 'brand', 'manufactureYear', 'color', 'chassisNumber', 'engineNumber', 'fuelCardNumber', 'standardFuelConsumption', 'assignedTo', 'licenseStatus', 'licenseExpiry', 'status'],
          ['رقم اللوحة', 'نوع السيارة', 'الموديل', 'سنة الصنع', 'اللون', 'رقم الشاسيه', 'رقم الماتور', 'رقم الكارت', 'المعدل القياسي للاستهلاك', 'صاحب العهدة', 'حالة الرخصة', 'انتهاء الترخيص', 'الحالة']
        );
      }
    );

    // 10) المأموريات
    await add(
      'المأموريات', 'تقرير المأموريات',
      ['رقم أمر الشغل', 'رقم السيارة', 'اسم السائق', 'تاريخ البداية', 'تاريخ النهاية', 'الوجهة', 'الحالة', 'عداد الخروج', 'عداد الدخول', 'المسافة المقطوعة'],
      ['المسافة المقطوعة'],
      async () => {
        const data = await this.getMissionsReport(startDate, endDate);
        const rows = mapRows(
          data.details,
          ['orderNumber', 'vehicleId', 'driverName', 'startDate', 'endDate', 'destination', 'status', 'startKM', 'endKM', 'totalKM'],
          ['رقم أمر الشغل', 'رقم السيارة', 'اسم السائق', 'تاريخ البداية', 'تاريخ النهاية', 'الوجهة', 'الحالة', 'عداد الخروج', 'عداد الدخول', 'المسافة المقطوعة']
        );
        // ✅ نفس منطق صفحة التقارير: لو اسم السائق فاضي نجيبه من جدول السائقين بالـ driverId
        try {
          const rawMissions: any[] =
            ((await this.missionRepo?.findAll({
              filter: { startDate: { $gte: startDate, $lte: endDate } },
            })) as any[]) || [];
          const drivers: any[] = ((await this.driverRepo?.findAll()) as any[]) || [];
          const nameById = new Map<string, string>();
          drivers.forEach((d: any) => nameById.set(String(d.id), d.fullName || d.name || String(d.id)));
          rows.forEach((row: any, i: number) => {
            const m = rawMissions[i];
            if (!row['اسم السائق'] && m?.driverId) {
              row['اسم السائق'] = nameById.get(String(m.driverId)) || String(m.driverId);
            }
          });
        } catch (_e) {
          /* اسم السائق اختياري — نكمل من غيره */
        }
        return rows;
      }
    );

    // 11) المخزون
    await add(
      'المخزون', 'تقرير المخزون',
      ['الكود', 'اسم الصنف', 'الرصيد الحالي', 'الحد الأدنى', 'سعر الوحدة', 'القيمة الإجمالية'],
      ['الرصيد الحالي', 'الحد الأدنى', 'القيمة الإجمالية'],
      async () => {
        const data = await this.getInventoryReport(startDate, endDate);
        return mapRows(
          data.details,
          ['code', 'name', 'currentStock', 'minimumStock', 'unitPrice', 'totalValue'],
          ['الكود', 'اسم الصنف', 'الرصيد الحالي', 'الحد الأدنى', 'سعر الوحدة', 'القيمة الإجمالية']
        );
      }
    );

    // 12) المشتريات
    await add(
      'المشتريات', 'تقرير المشتريات',
      ['رقم أمر الشراء', 'المورد', 'التاريخ', 'الإجمالي', 'الحالة'],
      ['الإجمالي'],
      async () => {
        const data = await this.getPurchasingReport(startDate, endDate);
        return mapRows(
          data.details,
          ['orderNumber', 'supplier', 'date', 'total', 'status'],
          ['رقم أمر الشراء', 'المورد', 'التاريخ', 'الإجمالي', 'الحالة']
        );
      }
    );

    // 13) الإيجارات
    await add(
      'الإيجارات', 'تقرير الإيجارات',
      ['تاريخ بداية المأمورية', 'تاريخ نهاية المأمورية', 'الجهة', 'وجهة السفر', 'نوع السيارة', 'النوع', 'عدد الأيام', 'رقم أمر الشغل', 'القيمة الايجارية', 'المبيت', 'بدل السائق', 'الاجمالي', 'حساب الجهة', 'بيانات السداد', 'السائق', 'رقم السيارة'],
      ['عدد الأيام', 'القيمة الايجارية', 'المبيت', 'بدل السائق', 'الاجمالي'],
      async () => this.getRentalsReport(startDate, endDate)
    );

    // 14) كروت الوقود
    await add(
      'كروت الوقود', 'تقرير كروت الوقود',
      ['م', 'رقم اللوحه', 'نوع المنتج', 'نوع الكارت', 'رقم الكارت'],
      [],
      async () => this.getFuelCardsReport()
    );

    // 15/16/17) تقارير المركبات (بدون فترة زمنية)
    const vehicleHeaders = [
      'اسم البيان', 'نوع البيان', 'الموديل', 'رقم العربة', 'سنة الصنع',
      'رقم الشاسية', 'رقم الماتور', 'حالة الرخصة', 'انتهاء الترخيص', 'اللون',
      'الحمولة المدونة ', 'نوع الوقود', 'مكان تواجد العربة', 'عدد الخطوط لكل مركبة',
      'نسبة الصلاحية الفنية', 'الحالة الفنية للمركبة', 'نوع الاصلاح',
      'نسبة اصلاح العطل', 'ملاحظات',
    ];
    await add('أتوبيس-ميني باص-ميكروباص', 'الأتوبيس - ميني باص - ميكروباص', vehicleHeaders, [], async () => this.getBusReport());
    await add('بيك اب-نقل-لوري', 'البيك اب - النقل - اللوري', vehicleHeaders, [], async () => this.getTruckReport());
    await add('الملاكي', 'تقرير الملاكي', vehicleHeaders, [], async () => this.getPrivateReport());

    return sections;
  }

  async getAllReportsExcel(startDate: string, endDate: string): Promise<string> {
    const sections = await this.buildAllReportsSections(startDate, endDate);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Fleet ERP';
    workbook.created = new Date();

    // ---------- شيت الفهرس (بيتكتب الأول عشان يبقى أول شيت) ----------
    const indexSheet = this.createArabicWorksheet(workbook, 'الفهرس');
    const idxTitle = indexSheet.addRow(['التقرير الشامل المجمّع']);
    indexSheet.mergeCells(idxTitle.number, 1, idxTitle.number, 4);
    idxTitle.getCell(1).font = { bold: true, size: 16 };
    idxTitle.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    idxTitle.height = 28;

    const idxPeriod = indexSheet.addRow([`من ${startDate} إلى ${endDate}`]);
    indexSheet.mergeCells(idxPeriod.number, 1, idxPeriod.number, 4);
    idxPeriod.getCell(1).font = { bold: true, size: 12 };
    idxPeriod.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    indexSheet.addRow([]);

    this.styleHeaderRow(indexSheet.addRow(['م', 'التقرير', 'عدد السجلات', 'الحالة']));

    sections.forEach((s, i) => {
      const row = indexSheet.addRow([
        i + 1,
        { text: s.title, hyperlink: `#'${s.sheetName}'!A1` } as any,
        s.rows.length,
        s.error ? `تعذر التحميل: ${s.error}` : 'تم',
      ]);
      this.styleDataRow(row);
      row.getCell(2).font = { size: 11, color: { argb: 'FF0563C1' }, underline: true };
    });
    this.autoFitColumns(indexSheet);

    // ---------- شيت لكل تقرير ----------
    for (const s of sections) {
      const sheet = this.createArabicWorksheet(workbook, s.sheetName);
      const colCount = s.headers.length;

      const titleRow = sheet.addRow([s.title]);
      sheet.mergeCells(titleRow.number, 1, titleRow.number, Math.max(colCount, 1));
      titleRow.getCell(1).font = { bold: true, size: 16 };
      titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 28;

      const periodRow = sheet.addRow([`من ${startDate} إلى ${endDate}`]);
      sheet.mergeCells(periodRow.number, 1, periodRow.number, Math.max(colCount, 1));
      periodRow.getCell(1).font = { bold: true, size: 12 };
      periodRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.addRow([]);

      const headerRow = sheet.addRow(s.headers);
      this.styleHeaderRow(headerRow);

      const firstDataRow = headerRow.number + 1;
      for (const item of s.rows) {
        const values = s.headers.map((h) => {
          const v = item?.[h];
          if (v === null || v === undefined) return '';
          if (v instanceof Date) return v;
          if (typeof v === 'object') return JSON.stringify(v);
          return v;
        });
        this.styleDataRow(sheet.addRow(values));
      }
      const lastDataRow = firstDataRow + s.rows.length - 1;

      // ---------- صف الإجمالي ----------
      const custom = s.customTotals ? s.customTotals(s.rows) : {};
      const totalValues: any[] = s.headers.map((h, ci) => {
        if (ci === 0) return `الإجمالي (${s.rows.length} سجل)`;
        if (s.sumColumns.includes(h)) {
          if (s.rows.length === 0) return 0;
          const total = s.rows.reduce(
            (sum, r) => sum + (Number(String(r?.[h] ?? '').replace(/,/g, '')) || 0),
            0
          );
          const letter = sheet.getColumn(ci + 1).letter;
          return { formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`, result: total };
        }
        if (h in custom) return custom[h];
        return '';
      });

      const totalRow = sheet.addRow(totalValues);
      this.styleDataRow(totalRow);
      totalRow.eachCell((c) => {
        c.font = { bold: true, size: 12 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      });
      s.headers.forEach((h, ci) => {
        if (s.sumColumns.includes(h) || h in custom) {
          const cell = totalRow.getCell(ci + 1);
          const raw: any = cell.value;
          const n = typeof raw === 'number' ? raw : Number(raw?.result) || 0;
          cell.numFmt = Number.isInteger(n) ? '#,##0' : '#,##0.00';
        }
      });
      totalRow.height = 24;

      sheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: headerRow.number }];
      this.autoFitColumns(sheet);
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `التقرير_الشامل_${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    logger.info(`✅ Comprehensive report exported: ${filePath}`);
    return filePath;
  }

  // ============================================================
  // ===== تصدير Excel و PDF عام =====
  // ============================================================

  async exportToExcel(data: any, filename: string, customHeaders?: string[], sheetTitle: string = 'تقرير'): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = this.createArabicWorksheet(workbook, sheetTitle);

    let items: any[] = [];

    if (data && typeof data === 'object') {
      if (data.details && Array.isArray(data.details)) {
        items = data.details;
      } else if (data.movements && Array.isArray(data.movements)) {
        items = data.movements;
      } else if (Array.isArray(data)) {
        items = data;
      } else if (data.data && Array.isArray(data.data)) {
        items = data.data;
      } else {
        items = [data];
      }
    }

    const headers = customHeaders || Object.keys(items[0] || {});

    if (headers.length > 0) {
      const headerRow = worksheet.addRow(headers);
      this.styleHeaderRow(headerRow);

      for (const item of items) {
        const rowValues = headers.map((h) => {
          const value = item[h];
          if (value === null || value === undefined) return '';
          if (value instanceof Date) return value;
          if (typeof value === 'object') return JSON.stringify(value);
          return value;
        });
        const row = worksheet.addRow(rowValues);
        this.styleDataRow(row);
      }

      worksheet.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
    }

    this.autoFitColumns(worksheet);

    const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    await workbook.xlsx.writeFile(filePath);

    logger.info(`✅ Excel report exported: ${filePath}`);
    return filePath;
  }

  /**
   * ✅ FIX: تشكيل الحروف العربية (ligatures/الأشكال السياقية للحرف حسب موضعه)
   * ثم إعادة ترتيبها بخوارزمية bidi عشان تتعرض صح جوه PDFKit، اللي أصلاً
   * بيرسم كل Unicode code point لوحده من غير ما يوصل الحروف ولا يعكس
   * اتجاه القراءة. من غير الخطوة دي بيطلع النص عربي مقطّع ومقلوب.
   * النص المختلط (عربي + أرقام/لاتيني) بيتعامل معاه صح لأن bidi-js
   * بيطبق خوارزمية Unicode Bidirectional Algorithm الكاملة.
   */
  private shapeArabic(text: any): string {
    if (text === null || text === undefined) return '';
    const str = String(text);
    try {
      const reshaped = (arabicReshaper as any).convertArabic(str);
      const embeddingLevels = bidi.getEmbeddingLevels(reshaped);
      return bidi.getReorderedString(reshaped, embeddingLevels);
    } catch (error) {
      logger.error('Error shaping Arabic text for PDF:', error);
      return str;
    }
  }

  /**
   * ✅ FIX: يسجل خط Tajawal (نفس خط الواجهة) بدل Helvetica اللي أصلاً
   * مالوش أي رموز عربية، عشان كده كانت الحروف بتطلع غلط تمامًا.
   * ضع ملفي الخط في fonts/Tajawal-Regular.ttf و fonts/Tajawal-Bold.ttf
   * في جذر المشروع (بجانب مجلد src)، أو غيّر المسار هنا لو حابب تحطهم
   * في مكان تاني.
   */
  private registerArabicFonts(doc: PDFKit.PDFDocument): void {
    const fontsDir = path.join(process.cwd(), 'fonts');
    const regularPath = path.join(fontsDir, 'Tajawal-Regular.ttf');
    const boldPath = path.join(fontsDir, 'Tajawal-Bold.ttf');

    if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
      doc.registerFont('Arabic', regularPath);
      doc.registerFont('Arabic-Bold', boldPath);
    } else {
      // فallback لو ملفات الخط مش موجودة: على الأقل منمنعش انهيار السيرفر،
      // لكن النص العربي هيفضل معطوب لحد ما تحط ملفات الخط في fonts/
      logger.error(
        `⚠️ Arabic font files not found at ${fontsDir}. Falling back to Helvetica — Arabic text will render incorrectly. Place Tajawal-Regular.ttf and Tajawal-Bold.ttf in ${fontsDir}`
      );
      doc.registerFont('Arabic', 'Helvetica');
      doc.registerFont('Arabic-Bold', 'Helvetica-Bold');
    }
  }

  async exportToPDF(data: any, filename: string, title: string = 'تقرير'): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, layout: 'landscape' });

        this.registerArabicFonts(doc);
        const shape = (t: any) => this.shapeArabic(t);

        const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, filename);
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        doc.fontSize(22).font('Arabic-Bold').text(shape(title), { align: 'center' });
        doc.moveDown();

        doc.fontSize(10).font('Arabic')
          .text(shape(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`), { align: 'right' });
        doc.moveDown();

        let items: any[] = [];
        let summary: any = null;

        if (data && typeof data === 'object') {
          if (data.summary) {
            summary = data.summary;
          }

          if (data.details && Array.isArray(data.details)) {
            items = data.details;
          } else if (data.movements && Array.isArray(data.movements)) {
            items = data.movements;
          } else if (Array.isArray(data)) {
            items = data;
          } else if (data.data && Array.isArray(data.data)) {
            items = data.data;
          } else {
            const keys = Object.keys(data);
            if (keys.length > 0 && !data.summary && !data.details && !data.movements) {
              items = [data];
            }
          }
        }

        if (summary && Object.keys(summary).length > 0) {
          doc.fontSize(14).font('Arabic-Bold').text(shape('📊 الملخص:'));
          doc.fontSize(10).font('Arabic');

          let summaryY = doc.y;
          // ✅ FIX: بما إن الصفحة عربي RTL، أول عنصر لازم يبدأ من أقصى
          // اليمين مش الشمال، فبنبدأ xPos من يمين الصفحة وبننقص كل مرة
          const colWidth = (doc.page.width - 100) / Math.min(Object.keys(summary).length, 4);
          let xPos = doc.page.width - 50 - colWidth;

          for (const [key, value] of Object.entries(summary)) {
            const label = translateHeader(key);
            const displayValue = typeof value === 'number' ? value.toLocaleString() : String(value);

            doc.text(shape(`${label}: ${displayValue}`), xPos, summaryY, {
              width: colWidth,
              align: 'right',
              continued: false
            });
            xPos -= colWidth;
            if (xPos < 50) {
              xPos = doc.page.width - 50 - colWidth;
              summaryY += 20;
            }
          }
          doc.moveDown(2);
        }

        if (items.length > 0) {
          const headers = Object.keys(items[0] || {});
          const displayHeaders = headers.slice(0, 8);

          if (displayHeaders.length > 0) {
            const translatedHeaders = displayHeaders.map(h => translateHeader(h));
            const colWidth = Math.min(120, Math.floor((doc.page.width - 100) / displayHeaders.length));
            // ✅ FIX: نفس فكرة الـ RTL — أول عمود (أول حقل في البيانات)
            // لازم يظهر أقصى اليمين، فبنرسم الأعمدة من اليمين للشمال
            const rightEdge = doc.page.width - 50;

            doc.fontSize(11).font('Arabic-Bold');
            let y = doc.y;

            let x = rightEdge - colWidth;
            for (const header of translatedHeaders) {
              doc.text(shape(header), x, y, { width: colWidth, align: 'center' });
              x -= colWidth;
            }
            y += 20;

            doc.moveTo(rightEdge, y - 5).lineTo(rightEdge - (colWidth * displayHeaders.length), y - 5).stroke();

            doc.fontSize(9).font('Arabic');

            for (const item of items.slice(0, 30)) {
              if (y > doc.page.height - 80) {
                doc.addPage();
                y = 50;

                doc.fontSize(11).font('Arabic-Bold');
                x = rightEdge - colWidth;
                for (const header of translatedHeaders) {
                  doc.text(shape(header), x, y, { width: colWidth, align: 'center' });
                  x -= colWidth;
                }
                y += 20;
                doc.moveTo(rightEdge, y - 5).lineTo(rightEdge - (colWidth * displayHeaders.length), y - 5).stroke();
                doc.fontSize(9).font('Arabic');
              }

              x = rightEdge - colWidth;
              for (const header of displayHeaders) {
                let value = item[header];
                let displayText = '';

                if (value === null || value === undefined) {
                  displayText = '-';
                } else if (typeof value === 'object') {
                  displayText = JSON.stringify(value).substring(0, 20);
                } else if (typeof value === 'number') {
                  displayText = value.toLocaleString();
                } else {
                  displayText = String(value).substring(0, 25);
                }

                doc.text(shape(displayText), x, y, { width: colWidth, align: 'center' });
                x -= colWidth;
              }
              y += 15;
            }

            if (items.length > 30) {
              doc.fontSize(8).font('Arabic');
              doc.text(shape(`... عرض أول 30 نتيجة من ${items.length}`), 50, y + 10, { align: 'center' });
            }
          } else {
            doc.font('Arabic').text(shape('⚠️ لا توجد أعمدة لعرضها'), 50, doc.y, { align: 'center' });
          }
        } else {
          doc.font('Arabic').text(shape('⚠️ لا توجد بيانات لعرضها'), 50, doc.y, { align: 'center' });
        }

        doc.end();

        stream.on('finish', () => {
          logger.info(`✅ PDF report exported: ${filePath}`);
          resolve(filePath);
        });

        stream.on('error', (err) => {
          logger.error(`Error writing PDF: ${err}`);
          reject(err);
        });

      } catch (error) {
        logger.error(`Error generating PDF: ${error}`);
        reject(error);
      }
    });
  }
}

// ============================================================
// ===== دالة ترجمة أسماء الأعمدة =====
// ============================================================
function translateHeader(header: string): string {
  const translations: Record<string, string> = {
    'id': 'المعرف',
    'name': 'الاسم',
    'code': 'الكود',
    'status': 'الحالة',
    'createdAt': 'تاريخ الإنشاء',
    'updatedAt': 'تاريخ التحديث',
    'date': 'التاريخ',
    'total': 'الإجمالي',
    'count': 'العدد',
    'notes': 'ملاحظات',
    'description': 'الوصف',
    'type': 'النوع',
    'priority': 'الأولوية',
    'isActive': 'نشط',
    'isDeleted': 'محذوف',
    'version': 'الإصدار',
    'vehicleId': 'معرف السيارة',
    'vehiclePlate': 'رقم السيارة',
    'plateNumber': 'رقم اللوحة',
    'vehicleType': 'نوع السيارة',
    'brand': 'الموديل',
    'model': 'الموديل',
    'manufactureYear': 'سنة الصنع',
    'color': 'اللون',
    'fuelType': 'نوع الوقود',
    'currentKM': 'العداد الحالي',
    'assignedTo': 'صاحب العهدة',
    'licenseStatus': 'حالة الرخصة',
    'licenseExpiry': 'انتهاء الترخيص',
    'operation': 'التشغيل',
    'capacity': 'الحمولة المدونة',
    'passengerCount': 'عدد الركاب',
    'loadCapacity': 'الحمولة',
    'technicalRating': 'نسبة الصلاحية الفنية',
    'technicalCondition': 'الحالة الفنية',
    'bodyType': 'نوع البيان',
    'engineCapacity': 'السعة',
    'cylinders': 'عدد السلندرات',
    'licenseDate': 'تاريخ الترخيص',
    'chassisNumber': 'رقم الشاسيه',
    'engineNumber': 'رقم الموتور',
    'tankCapacity': 'سعة تنك الوقود',
    'location': 'مكان تواجد العربة',
    'garage': 'مكان تواجد العربة',
    'linesCount': 'عدد الخطوط لكل مركبة',
    'repairType': 'نوع الاصلاح',
    'repairPercentage': 'نسبة اصلاح العطل',
    'maintenanceCost': 'تكلفة الصيانة',
    'partsCost': 'تكلفة قطع الغيار',
    'totalCost': 'الإجمالي',
    'laborCost': 'تكلفة العمالة',
    'orderNumber': 'رقم الأمر',
    'problem': 'المشكلة',
    'startDate': 'تاريخ البداية',
    'endDate': 'تاريخ النهاية',
    'repairStatus': 'حالة الإصلاح',
    'fuelCost': 'تكلفة الوقود',
    'totalFuel': 'إجمالي الوقود (لتر)',
    'avgConsumption': 'متوسط الاستهلاك (لتر/كم)',
    'fuelQuantity': 'كمية الوقود',
    'fuelPrice': 'سعر الوقود',
    'distance': 'المسافة',
    'missionNumber': 'رقم المأمورية',
    'driverName': 'اسم السائق',
    'destination': 'وجهة السفر',
    'route': 'خط السير',
    'startKM': 'عداد الخروج',
    'endKM': 'عداد الدخول',
    'totalKM': 'المسافة المقطوعة',
    'startTime': 'ساعة الخروج',
    'endTime': 'ساعة الدخول',
    'entityName': 'الجهة الطالبة',
    'rentalNumber': 'رقم الإيجار',
    'rentalValue': 'القيمة الايجارية',
    'overnight': 'المبيت',
    'account': 'حساب الجهة',
    'paymentData': 'بيانات السداد',
    'days': 'عدد الأيام',
    'cardNumber': 'رقم الكارت',
    'cardType': 'نوع الكارت',
    'productType': 'نوع المنتج',
    'issuer': 'الجهة المصدرة',
    'totalVehicles': 'إجمالي السيارات',
    'totalOrders': 'إجمالي الأوامر',
    'completed': 'مكتمل',
    'inProgress': 'قيد التنفيذ',
    'pending': 'معلق',
    'cancelled': 'ملغي',
    'averageCost': 'متوسط التكلفة',
    'totalParts': 'إجمالي القطع',
    'totalQuantityUsed': 'إجمالي الكمية المستخدمة',
    'totalExpenses': 'إجمالي المصروفات',
    'totalAmount': 'المبلغ الإجمالي',
    'purchaseCost': 'تكلفة المشتريات',
    'totalFineAmount': 'إجمالي الغرامات',
    'totalPaidAmount': 'إجمالي المدفوع',
    'unpaidAmount': 'المبلغ غير المدفوع',
    'اسم البيان': 'اسم البيان',
    'الموديل': 'الموديل',
    'رقم العربة': 'رقم العربة',
    'سنة الصنع': 'سنة الصنع',
    'اللون': 'اللون',
    'التشغيل': 'التشغيل',
    'الحمولة المدونة': 'الحمولة المدونة',
    'نوع البيان': 'نوع البيان',
    'رقم المركبة': 'رقم المركبة',
    'تشغيل المركبة': 'تشغيل المركبة',
    'رقم اللوحه': 'رقم اللوحه',
    'نوع المنتج': 'نوع المنتج',
    'نوع الكارت': 'نوع الكارت',
    'رقم الكارت': 'رقم الكارت',
    'رقم الشاسية': 'رقم الشاسية',
    'رقم الماتور': 'رقم الماتور',
    'حالة الرخصة': 'حالة الرخصة',
    'انتهاء الترخيص': 'انتهاء الترخيص',
    'نوع الوقود': 'نوع الوقود',
    'مكان تواجد العربة': 'مكان تواجد العربة',
    'عدد الخطوط لكل مركبة': 'عدد الخطوط لكل مركبة',
    'نسبة الصلاحية الفنية': 'نسبة الصلاحية الفنية',
    'الحالة الفنية للمركبة': 'الحالة الفنية للمركبة',
    'نوع الاصلاح': 'نوع الاصلاح',
    'نسبة اصلاح العطل': 'نسبة اصلاح العطل',
    'ملاحظات': 'ملاحظات',
    'تاريخ بداية المأمورية': 'تاريخ بداية المأمورية',
    'تاريخ نهاية المأمورية': 'تاريخ نهاية المأمورية',
    'الجهة': 'الجهة',
    'وجهة السفر': 'وجهة السفر',
    'نوع السيارة': 'نوع السيارة',
    'عدد الأيام': 'عدد الأيام',
    'رقم أمر الشغل': 'رقم أمر الشغل',
    'القيمة الايجارية': 'القيمة الايجارية',
    'المبيت': 'المبيت',
    'الاجمالي': 'الإجمالي',
    'حساب الجهة': 'حساب الجهة',
    'بيانات السداد': 'بيانات السداد',
    'السائق': 'السائق',
    'رقم السيارة': 'رقم السيارة',
    'م': 'م',
    'تاريخ الخروج': 'تاريخ الخروج',
    'تاريخ الدخول': 'تاريخ الدخول',
    'عداد الخروج': 'عداد الخروج',
    'عداد الدخول': 'عداد الدخول',
    'المسافة المقطوعة': 'المسافة المقطوعة',
    'ساعة الخروج': 'ساعة الخروج',
    'ساعة الدخول': 'ساعة الدخول',
    'اسم السائق': 'اسم السائق',
    'خط السير': 'خط السير',
    'الجهة الطالبة': 'الجهة الطالبة',
    'حالة المأمورية': 'حالة المأمورية',
    'إجمالي السيارات': 'إجمالي السيارات',
    'إجمالي التكلفة': 'إجمالي التكلفة',
    'إجمالي الوقود المستهلك': 'إجمالي الوقود المستهلك',
    'عدد مرات التعبئة': 'عدد مرات التعبئة',
    'تكلفة الصيانة': 'تكلفة الصيانة',
    'تكلفة الوقود': 'تكلفة الوقود',
    'تكلفة قطع الغيار': 'تكلفة قطع الغيار',
    'الإجمالي': 'الإجمالي',
    'إجمالي الوقود (لتر)': 'إجمالي الوقود (لتر)',
    'المسافة (كم)': 'المسافة (كم)',
    'متوسط الاستهلاك (لتر/كم)': 'متوسط الاستهلاك (لتر/كم)',
  };

  return translations[header] || header;
}