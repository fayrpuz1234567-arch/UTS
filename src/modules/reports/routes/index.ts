import { Router } from 'express';
import { ReportsController } from '../controllers/reports.controller';
import { ReportRepository } from '../repositories/reports.repository';
import { ReportsService } from '../services/reports.service';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';
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
import { AccidentRepository } from '../../accidents/repositories/accident.repository';
import { ViolationRepository } from '../../violations/repositories/violation.repository';

const router = Router();

// ===== Dependency Injection =====
const reportRepo = new ReportRepository();
const maintenanceRepo = new MaintenanceOrderRepository();
const purchaseRepo = new PurchaseOrderRepository();
const partRepo = new PartRepository();
const transactionRepo = new InventoryTransactionRepository();
const vehicleRepo = new VehicleRepository();
const fuelLogRepo = new FuelLogRepository();
const fuelCardRepo = new FuelCardRepository();
const rentalRepo = new RentalRepository();
const missionRepo = new MissionRepository();
const driverRepo = new DriverRepository();
const accidentRepo = new AccidentRepository();
const violationRepo = new ViolationRepository();

const reportsService = new ReportsService(
  reportRepo,
  maintenanceRepo,
  purchaseRepo,
  partRepo,
  transactionRepo,
  vehicleRepo,
  fuelLogRepo,
  fuelCardRepo,
  rentalRepo,
  missionRepo,
  driverRepo,
  undefined, // entityRepo
  accidentRepo,
  violationRepo
);
const reportsController = new ReportsController(reportsService);

// ============================================================
// ===== Report Routes =====
// ============================================================
router.post('/', authenticate, requireEditAccess('reports'), reportsController.create);
router.get('/', authenticate, requirePageAccess('reports'), reportsController.getAll);
router.get('/:id', authenticate, requirePageAccess('reports'), reportsController.getOne);
router.put('/:id', authenticate, requireEditAccess('reports'), reportsController.update);
router.delete('/:id', authenticate, requireEditAccess('reports'), reportsController.delete);
router.post('/generate', authenticate, requireEditAccess('reports'), reportsController.generate);
router.get('/:id/export', authenticate, requirePageAccess('reports'), reportsController.export);

// ============================================================
// ===== Advanced Report Routes =====
// ============================================================

// 1. تقرير الصيانة

// ===== تقرير السائقين (إيجارات) مع فلتر من / إلى =====
// ✅ FIX: التقرير ده بيتولّد من زرار "تصدير Excel" في صفحة السائقين نفسها
// (drivers.html)، فكان لازم يتفحص بصلاحية صفحة "drivers" مش صفحة "reports"
// المنفصلة. كان الأدمن اللي معاه صلاحية "السائقين" بس (من غير صلاحية
// "التقارير") بياخد 403 "ملكش صلاحية" لما يضغط تصدير Excel، مع إنه أصلاً
// شايف صفحة السائقين وعنده صلاحيتها. دلوقتي بيتفحص بصلاحية "drivers":
// - سوبر أدمن: يولّد التقرير دايمًا.
// - أدمن معاه صلاحية "drivers": يولّد التقرير عادي (ده نفس الأدمن اللي
//   يقدر يعرض/يعدّل/يضيف سائقين أصلاً، فطبيعي يقدر يصدّر تقريرهم).
// - مشاهد معاه صلاحية "drivers": يولّد التقرير برضه (قراءة فقط، requirePageAccess
//   بيسمح للمشاهد زي الأدمن) لكن يفضل ميقدرش يعدّل/يضيف لأن ده مش GET
//   عبر endpoints التعديل (requireEditAccess) أصلاً.
// - أي حساب (أدمن أو مشاهد) مش معاه صلاحية "drivers": لسه بياخد 403 زي ما
//   المفروض، حتى لو معاه صلاحية "reports".
router.get('/drivers/rental-summary', authenticate, requirePageAccess('drivers'), reportsController.getDriversRentalSummary);
router.get('/drivers/rental-summary/excel', authenticate, requirePageAccess('drivers'), reportsController.getDriversRentalSummaryExcel);

// ===== تقرير استهلاك الكروت + إجمالي الوقود =====
router.get('/fuel/cards-consumption/excel', authenticate, requirePageAccess('reports'), reportsController.getFuelCardsConsumptionExcel);

router.get('/maintenance/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getMaintenanceReport);
router.get('/maintenance/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getMaintenanceReportExcel);
router.get('/maintenance/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getMaintenanceReportPDF);

// 2. تقرير قطع الغيار
router.get('/parts/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getPartsReport);
router.get('/parts/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getPartsReportExcel);
router.get('/parts/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getPartsReportPDF);

// 3. تقرير التكاليف
router.get('/cost/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getCostReport);
router.get('/cost/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getCostReportExcel);
router.get('/cost/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getCostReportPDF);

// 4. تقرير المصروفات
router.get('/expenses/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getExpensesReport);
router.get('/expenses/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getExpensesReportExcel);
router.get('/expenses/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getExpensesReportPDF);

// 5. تقرير السيارات الأعلى تكلفة
router.get('/top-cost/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getTopCostVehiclesReport);
router.get('/top-cost/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getTopCostVehiclesExcel);
router.get('/top-cost/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getTopCostVehiclesPDF);

// 6. تقرير الأعطال المتكررة
router.get('/frequent-issues/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getFrequentIssuesReport);
router.get('/frequent-issues/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getFrequentIssuesExcel);
router.get('/frequent-issues/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getFrequentIssuesPDF);

// 7. تقرير السيارات الأعلى استهلاكاً للوقود
router.get('/top-fuel/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getTopFuelConsumptionReport);
router.get('/top-fuel/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getTopFuelConsumptionExcel);
router.get('/top-fuel/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getTopFuelConsumptionPDF);

// 8. تقرير شامل
router.get('/full/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getFullReport);
router.get('/full/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getFullReportExcel);
router.get('/full/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getFullReportPDF);

// ============================================================
// ===== Fleet Vehicle Reports =====
// ============================================================

// 1. تقرير الأتوبيس - ميني باص - ميكروباص
router.get('/vehicles/bus', authenticate, requirePageAccess('reports'), reportsController.getBusReport);
router.get('/vehicles/bus/excel', authenticate, requirePageAccess('reports'), reportsController.getBusReportExcel);
router.get('/vehicles/bus/pdf', authenticate, requirePageAccess('reports'), reportsController.getBusReportPDF);

// 2. تقرير البيك اب - النقل - اللوري
router.get('/vehicles/truck', authenticate, requirePageAccess('reports'), reportsController.getTruckReport);
router.get('/vehicles/truck/excel', authenticate, requirePageAccess('reports'), reportsController.getTruckReportExcel);
router.get('/vehicles/truck/pdf', authenticate, requirePageAccess('reports'), reportsController.getTruckReportPDF);

// 3. تقرير الملاكي
router.get('/vehicles/private', authenticate, requirePageAccess('reports'), reportsController.getPrivateReport);
router.get('/vehicles/private/excel', authenticate, requirePageAccess('reports'), reportsController.getPrivateReportExcel);
router.get('/vehicles/private/pdf', authenticate, requirePageAccess('reports'), reportsController.getPrivateReportPDF);

// 4. تقرير الكروت
router.get('/fuel-cards', authenticate, requirePageAccess('reports'), reportsController.getFuelCardsReport);
router.get('/fuel-cards/excel', authenticate, requirePageAccess('reports'), reportsController.getFuelCardsReportExcel);
router.get('/fuel-cards/pdf', authenticate, requirePageAccess('reports'), reportsController.getFuelCardsReportPDF);

// 5. تقرير الإيجارات
router.get('/rentals', authenticate, requirePageAccess('reports'), reportsController.getRentalsReport);
router.get('/rentals/excel', authenticate, requirePageAccess('reports'), reportsController.getRentalsReportExcel);
router.get('/rentals/pdf', authenticate, requirePageAccess('reports'), reportsController.getRentalsReportPDF);

// 6. تقرير الحركة
router.get('/movement', authenticate, requirePageAccess('reports'), reportsController.getMovementReport);
router.get('/movement/excel', authenticate, requirePageAccess('reports'), reportsController.getMovementReportExcel);
router.get('/movement/pdf', authenticate, requirePageAccess('reports'), reportsController.getMovementReportPDF);

// ============================================================
// ===== Report Routes (Short names for frontend) =====
// ============================================================

// تقرير الوقود
router.get('/fuel/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getFuelReport);
router.get('/fuel/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getFuelReportExcel);
router.get('/fuel/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getFuelReportPDF);

// تقرير السيارات
router.get('/vehicles-report/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getVehiclesReport);
router.get('/vehicles-report/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getVehiclesReportExcel);
router.get('/vehicles-report/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getVehiclesReportPDF);

// تقرير المأموريات
router.get('/missions-report/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getMissionsReport);
router.get('/missions-report/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getMissionsReportExcel);
router.get('/missions-report/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getMissionsReportPDF);

// تقرير المخزون
router.get('/inventory-report/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getInventoryReport);
router.get('/inventory-report/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getInventoryReportExcel);
router.get('/inventory-report/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getInventoryReportPDF);

// تقرير المشتريات
router.get('/purchasing-report/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getPurchasingReport);
router.get('/purchasing-report/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getPurchasingReportExcel);
router.get('/purchasing-report/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getPurchasingReportPDF);

// ============================================================
// ===== Frontend-Compatible Aliases (المسارات اللي الفرونت إند بينادي عليها فعلياً) =====
// ============================================================

// تقرير السيارات
router.get('/vehicles/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getVehiclesReport);
router.get('/vehicles/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getVehiclesReportExcel);
router.get('/vehicles/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getVehiclesReportPDF);

// تقرير المأموريات
router.get('/missions/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getMissionsReport);
router.get('/missions/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getMissionsReportExcel);
router.get('/missions/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getMissionsReportPDF);

// تقرير المخزون
router.get('/inventory/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getInventoryReport);
router.get('/inventory/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getInventoryReportExcel);
router.get('/inventory/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getInventoryReportPDF);

// تقرير المشتريات
router.get('/purchasing/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getPurchasingReport);
router.get('/purchasing/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getPurchasingReportExcel);
router.get('/purchasing/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getPurchasingReportPDF);

// تقرير السيارات الأعلى تكلفة (camelCase - المسار اللي الفرونت إند بينادي عليه)
router.get('/topCost/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getTopCostVehiclesReport);
router.get('/topCost/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getTopCostVehiclesExcel);
router.get('/topCost/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getTopCostVehiclesPDF);

// تقرير السيارات الأعلى استهلاكاً للوقود (camelCase - المسار اللي الفرونت إند بينادي عليه)
router.get('/topFuel/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getTopFuelConsumptionReport);
router.get('/topFuel/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getTopFuelConsumptionExcel);
router.get('/topFuel/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getTopFuelConsumptionPDF);

// تقرير الأعطال المتكررة (camelCase - احتياطي لنفس النمط)
router.get('/frequentIssues/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getFrequentIssuesReport);
router.get('/frequentIssues/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getFrequentIssuesExcel);
router.get('/frequentIssues/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getFrequentIssuesPDF);

// تقرير المصروفات
router.get('/expenses-short/:startDate/:endDate', authenticate, requirePageAccess('reports'), reportsController.getExpensesReport);
router.get('/expenses-short/:startDate/:endDate/excel', authenticate, requirePageAccess('reports'), reportsController.getExpensesReportExcel);
router.get('/expenses-short/:startDate/:endDate/pdf', authenticate, requirePageAccess('reports'), reportsController.getExpensesReportPDF);

// ============================================================
// ===== Vehicle Full Report (تقرير السيارة الشامل) =====
// ============================================================

/**
 * تقرير السيارة الشامل - يحتوي على كل تفاصيل السيارة:
 * - بيانات السيارة الأساسية
 * - استهلاك الوقود
 * - المأموريات
 * - الصيانة
 * - الإيجارات
 * - الحوادث
 * - المخالفات
 * - ملخص إحصائي
 */

// ✅ FIX: كانت المسارات دي متحطلهاش requirePageAccess خالص (authenticate بس)،
// يعني أي حساب مسجّل دخول - حتى لو مالوش أي صلاحية على أي صفحة - كان يقدر
// يجيب تقرير السيارة الشامل. دلوقتي بيتفحص بصلاحية صفحة "vehicles" زي باقي
// تقارير السيارات، فمشاهد/أدمن معاه صلاحية "vehicles" يولّد التقرير عادي،
// وأي حد من غيرها بياخد 403.

// JSON Report
router.get(
  '/vehicle/:vehicleId/full-report',
  authenticate,
  requirePageAccess('vehicles'),
  reportsController.getVehicleFullReport
);

// Excel Export
router.get(
  '/vehicle/:vehicleId/full-report/excel',
  authenticate,
  requirePageAccess('vehicles'),
  reportsController.getVehicleFullReportExcel
);

// PDF Export
router.get(
  '/vehicle/:vehicleId/full-report/pdf',
  authenticate,
  requirePageAccess('vehicles'),
  reportsController.getVehicleFullReportPDF
);

// ============================================================
// ===== All Drivers Full Report (تقرير شامل لكل السائقين) =====
// ============================================================

// ✅ FIX: نفس المشكلة - كان مفيهوش requirePageAccess، فأي حساب مسجّل دخول
// يقدر يصدّر تقرير كل السائقين حتى لو مالوش صلاحية صفحة "drivers" أصلاً.
// دلوقتي بيتفحص بصلاحية "drivers" زي زرار التصدير التاني في نفس الصفحة.
//
// Excel Export — يحترم فلاتر البحث والحالة زي ما هي في شاشة السائقين
router.get(
  '/drivers/full-report/excel',
  authenticate,
  requirePageAccess('drivers'),
  reportsController.getAllDriversFullReportExcel
);

// ============================================================
// ===== Driver Full Report (تقرير السائق الشامل) =====
// ============================================================

/**
 * تقرير السائق الشامل - يحتوي على كل تفاصيل السائق:
 * - بيانات السائق الأساسية
 * - المأموريات
 * - الإيجارات
 * - الحوادث
 * - المخالفات
 * - التموين بالوقود (لو مرتبط بالسائق)
 * - ملخص إحصائي
 */

// ✅ FIX: نفس المشكلة برضه - كانت المسارات دي بتفحص authenticate بس من غير
// requirePageAccess، دلوقتي بتتفحص بصلاحية صفحة "drivers".

// JSON Report
router.get(
  '/driver/:driverId/full-report',
  authenticate,
  requirePageAccess('drivers'),
  reportsController.getDriverFullReport
);

// Excel Export
router.get(
  '/driver/:driverId/full-report/excel',
  authenticate,
  requirePageAccess('drivers'),
  reportsController.getDriverFullReportExcel
);

// PDF Export
router.get(
  '/driver/:driverId/full-report/pdf',
  authenticate,
  requirePageAccess('drivers'),
  reportsController.getDriverFullReportPDF
);

export { router as reportsRouter };