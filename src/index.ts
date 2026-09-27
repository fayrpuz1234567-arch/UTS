// ✅ لازم dotenv.config() يتنادى قبل أي import تاني بيستخدم process.env (زي
// d1.config.ts). لو نده عليه بعد الـ imports (زي ما كان قبل كده)، الموديولات
// اللي بتتحمّل قبله (auth.middleware → repositories → D1) هتلاقي متغيرات
// البيئة لسه فاضية ولو ده اللي كان بيسبب خطأ "Missing Cloudflare D1
// credentials" حتى لو ملف .env نفسه مظبوط صح.
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { logger } from './core/utils/logger';
import { errorHandler } from './core/middleware/error.middleware';
import { initializeD1 } from './core/config/d1.config';
import { authenticate, requirePageAccess } from './core/middleware/auth.middleware';
import { AuditService } from './modules/audit/services/audit.service';

// Core Modules
import { authRouter } from './modules/auth/routes';
import { usersRouter } from './modules/users/routes';
import { vehicleRouter } from './modules/vehicles/routes';
import { driverRouter } from './modules/drivers/routes';
import { missionRouter } from './modules/missions/routes';
import { rentalsRouter } from './modules/rentals/routes';
import { fuelRouter } from './modules/fuel/routes';
import { maintenanceRouter } from './modules/maintenance/routes';
import { inventoryRouter } from './modules/inventory/routes';
import { purchasingRouter } from './modules/purchasing/routes';
import { reportsRouter } from './modules/reports/routes';
import { notificationRouter } from './modules/notifications/routes';

// Advanced Modules
import { settingsRouter } from './modules/settings/routes';
import { auditRouter } from './modules/audit/routes';
import { contractsRouter } from './modules/contracts/routes';
import { insuranceRouter } from './modules/insurance/routes';
import { accidentsRouter } from './modules/accidents/routes';
import { violationsRouter } from './modules/violations/routes';
import { workflowRouter } from './modules/workflow/routes';
import { rulesRouter } from './modules/rules/routes';
import { supplierRouter } from './modules/suppliers/routes';

// ✅ New Modules
import { entityRouter } from './modules/entities/routes';
import { trustRouter } from './modules/trusts/routes';

// ✅ Dashboard Module
import { dashboardRouter } from './modules/dashboard/routes';

// ✅ Employees Module — أصحاب العهد (السائقين + أي موظف آخر)
import { employeeRouter } from './modules/employees/routes';

// ✅ Calendar Plans Module — مواعيد التقويم (بدل التخزين المحلي IndexedDB)
import { calendarPlansRouter } from './modules/calendar-plans/routes';

// Initialize Cloudflare D1 first
initializeD1();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// ✅ CORS Configuration - السماح لجميع الأصول (للتطوير)
// ============================================================
// ✅ Manual CORS middleware - يحل مشكلة CORS
app.use((req: Request, res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;

  // ✅ السماح لجميع الأصول
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }

  // ✅ السماح بجميع الطلبات
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');

  // ✅ السماح بجميع الهيدرز المطلوبة
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Request-ID, Origin, X-Requested-With');

  // ✅ السماح بإرسال الكوكيز والتوكن
  res.header('Access-Control-Allow-Credentials', 'true');

  // ✅ كشف الهيدرز للعميل
  res.header('Access-Control-Expose-Headers', 'Content-Length, X-Request-ID');

  // ✅ معالجة طلبات OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
});

// ============================================================
// ✅ فلتر مبكر وخفيف لمحاولات فحص الثغرات المعروفة (بوتات بتدور على
// wp-admin, .php, .env, .git... إلخ زي اللي ظاهرة في اللوج). الطلبات
// دي أصلاً مش هتلاقي أي راوت حقيقي وهترجع 404 في الآخر، فبدل ما تعدي
// على كل الميدل وير التقيلة (helmet/compression/body-parser/rate
// limiter/تسجيل اللوج) من غير فايدة، بنردها فورًا من هنا. مفيش أي مسار
// حقيقي في النظام (كلهم تحت /api أو /health) بيتأثر بالأنماط دي.
// ============================================================
const SUSPICIOUS_PATH_PATTERN = /(\.php$|\.env$|\/wp-admin|\/wp-login|\/wp-content|\/xmlrpc\.php|\/\.git|\/\.aws|phpunit|cache\.php)/i;
app.use((req: Request, res: Response, next: NextFunction): void => {
  if (SUSPICIOUS_PATH_PATTERN.test(req.path)) {
    res.status(404).end();
    return;
  }
  next();
});

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
  message: 'Too many requests, please try again later.'
});
app.use('/api', limiter);

// Request Logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// ============================================================
// ✅ سجل العمليات التلقائي (Audit Trail) - مين عمل إيه وإمتى
// ============================================================
// ده middleware عام بيتسجّل مرة واحدة هنا فوق، وبيغطي كل موديولات
// النظام من غير ما نحتاج نعدّل كل كنترولر لوحده. بيشتغل بعد ما
// الطلب يخلص تمامًا (حدث 'finish' على الـ response) عشان في اللحظة
// دي يكون req.user اتحدد بالفعل من جوه authenticate() بتاع كل راوت،
// وكمان يكون الكود النهائي للـ response (statusCode) جاهز عشان
// نعرف العملية نجحت ولا فشلت.
// بيتسجل بس على الطلبات اللي بتغيّر بيانات: POST / PUT / PATCH / DELETE
// (الإضافة، التعديل، الحذف، وأي عملية تانية زي تغيير الحالة أو الصلاحيات).
// ============================================================
const auditService = new AuditService();

function resolveAuditAction(method: string, lastSegment: string | undefined): string {
  const looksLikeId = !!lastSegment && (
    /^[0-9a-fA-F-]{20,}$/.test(lastSegment) || /^\d+$/.test(lastSegment)
  );

  if (lastSegment && !looksLikeId) {
    // مسارات زي /:id/status أو /:id/roles أو /:id/pages أو /change-password
    return `${method.toLowerCase()}_${lastSegment.replace(/-/g, '_')}`;
  }

  switch (method) {
    case 'POST': return 'create';
    case 'PUT': return 'update';
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return method.toLowerCase();
  }
}

app.use((req: Request, res: Response, next: NextFunction): void => {
  const shouldTrack = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
    req.path.startsWith('/api/');

  if (!shouldTrack) {
    next();
    return;
  }

  const startedAt = Date.now();

  res.on('finish', () => {
    try {
      const segments = req.path.split('/').filter(Boolean); // ['api','v1','vehicles', ':id', ...]
      const moduleName = segments[2] || 'unknown';
      const lastSegment = segments[segments.length - 1];
      const recordId = segments.length > 3 ? segments[3] : undefined;

      const isLoginRoute = req.path.startsWith('/api/v1/auth/login');
      const action = isLoginRoute ? 'login' : resolveAuditAction(req.method, segments.length > 3 ? lastSegment : undefined);

      const status: 'success' | 'failure' | 'warning' =
        res.statusCode < 300 ? 'success' : (res.statusCode < 500 ? 'warning' : 'failure');

      auditService.log({
        userId: req.user?.id,
        username: req.user?.username || req.user?.email || (isLoginRoute ? req.body?.username : undefined),
        module: isLoginRoute ? 'auth' : moduleName,
        action,
        recordId,
        recordType: moduleName,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        duration: Date.now() - startedAt,
        status,
        errorMessage: status !== 'success' ? `HTTP ${res.statusCode}` : undefined,
        metadata: { path: req.path, method: req.method, statusCode: res.statusCode }
      }).catch(err => logger.error(`Audit log write failed: ${err}`));
    } catch (err) {
      logger.error(`Audit middleware error: ${err}`);
    }
  });

  next();
});

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '2.0.0',
    database: 'connected (Cloudflare D1)',
    modules: 25,
    cors: 'enabled'
  });
});

// ==================== API Routes ====================

// Core Modules
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);

// ============================================================
// ✅ صلاحيات الصفحات لكل موديول (Super Admin Control Panel)
// authenticate هنا مطلوب عشان requirePageAccess يقدر يقرأ req.user
// (الراوتر الداخلي بيعمل authenticate تاني، مفيش مشكلة، مجرد تأكيد إضافي)
// السوبر أدمن (أو أي دور إداري) بيتخطى الفحص ده تلقائيًا ويشوف كل حاجة.
// ============================================================
app.use('/api/v1/vehicles', authenticate, requirePageAccess('vehicles'), vehicleRouter);
app.use('/api/v1/drivers', authenticate, requirePageAccess('drivers'), driverRouter);
app.use('/api/v1/missions', authenticate, requirePageAccess('missions'), missionRouter);
app.use('/api/v1/rentals', authenticate, requirePageAccess('rentals'), rentalsRouter);
app.use('/api/v1/fuel', authenticate, requirePageAccess('fuel'), fuelRouter);
app.use('/api/v1/maintenance', authenticate, requirePageAccess('maintenance'), maintenanceRouter);
app.use('/api/v1/inventory', authenticate, requirePageAccess('inventory'), inventoryRouter);
app.use('/api/v1/purchasing', authenticate, requirePageAccess('purchasing'), purchasingRouter);
app.use('/api/v1/suppliers', authenticate, requirePageAccess('suppliers'), supplierRouter);
// ✅ FIX: راوتر التقارير (reportsRouter) بقى بيحدد صلاحية كل مسار لوحده
// (reports لمعظم التقارير، drivers لتقرير مستحقات/تقرير السائقين الشامل،
// vehicles لتقرير السيارة الشامل...). كان هنا فحص عام إضافي بيطلب صلاحية
// "reports" على *كل* مسارات /api/v1/reports/* قبل ما الطلب يوصل للراوتر
// الداخلي أصلاً، فحساب الأدمن اللي معاه صلاحية "drivers" بس (من غير
// "reports") كان بياخد 403 من الفحص العام ده، حتى لو مسار الطلب نفسه
// (زي /reports/drivers/rental-summary/excel) بيتفحص بصلاحية "drivers"
// جوه الراوتر. دلوقتي سيبنا الفحص التفصيلي للراوتر الداخلي بس.
app.use('/api/v1/reports', authenticate, reportsRouter);
app.use('/api/v1/notifications', notificationRouter);

// Advanced Modules
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/audit', auditRouter);
app.use('/api/v1/contracts', authenticate, requirePageAccess('contracts'), contractsRouter);
app.use('/api/v1/insurance', authenticate, requirePageAccess('insurance'), insuranceRouter);
app.use('/api/v1/accidents', authenticate, requirePageAccess('accidents'), accidentsRouter);
app.use('/api/v1/violations', authenticate, requirePageAccess('violations'), violationsRouter);
app.use('/api/v1/workflow', workflowRouter);
app.use('/api/v1/rules', rulesRouter);

// ✅ New Modules
app.use('/api/v1/entities', authenticate, requirePageAccess('entities'), entityRouter);
app.use('/api/v1/trusts', authenticate, requirePageAccess('trusts'), trustRouter);

// ✅ Dashboard Module
app.use('/api/v1/dashboard', dashboardRouter);

// ✅ Employees Module
app.use('/api/v1/employees', authenticate, requirePageAccess('employees'), employeeRouter);

// ✅ Calendar Plans
app.use('/api/v1/calendar-plans', authenticate, requirePageAccess('calendar-plans'), calendarPlansRouter);

// ==================== API Root ====================
app.get('/api/v1', (req: Request, res: Response) => {
  res.json({
    message: '🚀 FleetERP API',
    version: '2.0.0',
    modules: {
      core: [
        'auth', 'users', 'vehicles', 'drivers', 'missions',
        'rentals', 'fuel', 'maintenance', 'inventory',
        'purchasing', 'suppliers', 'reports', 'notifications'
      ],
      advanced: [
        'settings', 'audit', 'contracts', 'insurance',
        'accidents', 'violations', 'workflow', 'rules',
        'entities', 'trusts', 'dashboard', 'employees'
      ]
    },
    endpoints: {
      health: '/health',
      auth: {
        login: 'POST /api/v1/auth/login',
        register: 'POST /api/v1/auth/register',
        profile: 'GET /api/v1/auth/profile'
      },
      dashboard: {
        stats: 'GET /api/v1/dashboard/stats',
        profileStats: 'GET /api/v1/dashboard/profile-stats',
        activities: 'GET /api/v1/dashboard/activities',
        fuelChart: 'GET /api/v1/dashboard/fuel-chart',
        maintenanceChart: 'GET /api/v1/dashboard/maintenance-chart'
      },
      vehicles: {
        list: 'GET /api/v1/vehicles',
        create: 'POST /api/v1/vehicles',
        get: 'GET /api/v1/vehicles/:id',
        update: 'PUT /api/v1/vehicles/:id',
        delete: 'DELETE /api/v1/vehicles/:id',
        updateKM: 'PATCH /api/v1/vehicles/:id/km',
        updateStatus: 'PATCH /api/v1/vehicles/:id/status',
        available: 'GET /api/v1/vehicles/available',
        byStatus: 'GET /api/v1/vehicles/status/:status'
      },
      drivers: {
        list: 'GET /api/v1/drivers',
        create: 'POST /api/v1/drivers',
        get: 'GET /api/v1/drivers/:id',
        update: 'PUT /api/v1/drivers/:id',
        delete: 'DELETE /api/v1/drivers/:id',
        updateStatus: 'PATCH /api/v1/drivers/:id/status',
        assignVehicle: 'POST /api/v1/drivers/:id/assign-vehicle',
        unassignVehicle: 'DELETE /api/v1/drivers/:id/unassign-vehicle',
        available: 'GET /api/v1/drivers/available',
        byStatus: 'GET /api/v1/drivers/status/:status'
      },
      missions: {
        list: 'GET /api/v1/missions',
        create: 'POST /api/v1/missions',
        get: 'GET /api/v1/missions/:id',
        update: 'PUT /api/v1/missions/:id',
        delete: 'DELETE /api/v1/missions/:id',
        start: 'POST /api/v1/missions/:id/start',
        complete: 'POST /api/v1/missions/:id/complete',
        cancel: 'POST /api/v1/missions/:id/cancel',
        byVehicle: 'GET /api/v1/missions/vehicle/:vehicleId',
        byDriver: 'GET /api/v1/missions/driver/:driverId',
        byStatus: 'GET /api/v1/missions/status/:status'
      },
      rentals: {
        list: 'GET /api/v1/rentals',
        create: 'POST /api/v1/rentals',
        get: 'GET /api/v1/rentals/:id',
        update: 'PUT /api/v1/rentals/:id',
        delete: 'DELETE /api/v1/rentals/:id',
        activate: 'POST /api/v1/rentals/:id/activate',
        complete: 'POST /api/v1/rentals/:id/complete',
        cancel: 'POST /api/v1/rentals/:id/cancel'
      },
      fuel: {
        logs: {
          list: 'GET /api/v1/fuel/logs',
          create: 'POST /api/v1/fuel/logs',
          get: 'GET /api/v1/fuel/logs/:id',
          update: 'PUT /api/v1/fuel/logs/:id', // ✅ إضافة Route التحديث
          delete: 'DELETE /api/v1/fuel/logs/:id', // ✅ إضافة Route الحذف
          verify: 'PATCH /api/v1/fuel/logs/:id/verify',
          reject: 'PATCH /api/v1/fuel/logs/:id/reject',
          suspicious: 'GET /api/v1/fuel/logs/suspicious'
        },
        cards: {
          list: 'GET /api/v1/fuel/cards',
          create: 'POST /api/v1/fuel/cards',
          get: 'GET /api/v1/fuel/cards/:id',
          update: 'PUT /api/v1/fuel/cards/:id',
          delete: 'DELETE /api/v1/fuel/cards/:id'
        },
        stations: {
          list: 'GET /api/v1/fuel/stations',
          create: 'POST /api/v1/fuel/stations',
          get: 'GET /api/v1/fuel/stations/:id',
          update: 'PUT /api/v1/fuel/stations/:id',
          delete: 'DELETE /api/v1/fuel/stations/:id'
        },
        analytics: 'GET /api/v1/fuel/analytics'
      },
      maintenance: {
        orders: {
          list: 'GET /api/v1/maintenance/orders',
          create: 'POST /api/v1/maintenance/orders',
          get: 'GET /api/v1/maintenance/orders/:id',
          update: 'PUT /api/v1/maintenance/orders/:id',
          delete: 'DELETE /api/v1/maintenance/orders/:id',
          start: 'POST /api/v1/maintenance/orders/:id/start',
          complete: 'POST /api/v1/maintenance/orders/:id/complete',
          cancel: 'POST /api/v1/maintenance/orders/:id/cancel',
          approve: 'POST /api/v1/maintenance/orders/:id/approve',
          reject: 'POST /api/v1/maintenance/orders/:id/reject'
        },
        workshops: {
          list: 'GET /api/v1/maintenance/workshops',
          create: 'POST /api/v1/maintenance/workshops',
          get: 'GET /api/v1/maintenance/workshops/:id',
          update: 'PUT /api/v1/maintenance/workshops/:id',
          delete: 'DELETE /api/v1/maintenance/workshops/:id'
        },
        types: {
          list: 'GET /api/v1/maintenance/types',
          create: 'POST /api/v1/maintenance/types',
          get: 'GET /api/v1/maintenance/types/:id',
          update: 'PUT /api/v1/maintenance/types/:id',
          delete: 'DELETE /api/v1/maintenance/types/:id'
        },
        scheduled: {
          list: 'GET /api/v1/maintenance/scheduled',
          create: 'POST /api/v1/maintenance/scheduled',
          get: 'GET /api/v1/maintenance/scheduled/:id',
          update: 'PUT /api/v1/maintenance/scheduled/:id',
          delete: 'DELETE /api/v1/maintenance/scheduled/:id',
          complete: 'POST /api/v1/maintenance/scheduled/:id/complete',
          upcoming: 'GET /api/v1/maintenance/scheduled/upcoming/:days',
          overdue: 'GET /api/v1/maintenance/scheduled/overdue',
          vehicle: 'GET /api/v1/maintenance/scheduled/vehicle/:vehicleId',
          stats: 'GET /api/v1/maintenance/scheduled/stats'
        }
      },
      inventory: {
        parts: {
          list: 'GET /api/v1/inventory/parts',
          create: 'POST /api/v1/inventory/parts',
          get: 'GET /api/v1/inventory/parts/:id',
          update: 'PUT /api/v1/inventory/parts/:id',
          delete: 'DELETE /api/v1/inventory/parts/:id',
          lowStock: 'GET /api/v1/inventory/parts/low-stock',
          reorder: 'GET /api/v1/inventory/parts/reorder',
          expired: 'GET /api/v1/inventory/parts/expired',
          alerts: 'GET /api/v1/inventory/parts/alerts'
        },
        warehouses: {
          list: 'GET /api/v1/inventory/warehouses',
          create: 'POST /api/v1/inventory/warehouses',
          get: 'GET /api/v1/inventory/warehouses/:id',
          update: 'PUT /api/v1/inventory/warehouses/:id',
          delete: 'DELETE /api/v1/inventory/warehouses/:id'
        },
        transactions: {
          list: 'GET /api/v1/inventory/transactions',
          create: 'POST /api/v1/inventory/transactions',
          get: 'GET /api/v1/inventory/transactions/:id',
          approve: 'POST /api/v1/inventory/transactions/:id/approve',
          reject: 'POST /api/v1/inventory/transactions/:id/reject',
          byReference: 'GET /api/v1/inventory/transactions/by-reference',
          partMovements: 'GET /api/v1/inventory/transactions/part-movements',
          byTypeDate: 'GET /api/v1/inventory/transactions/by-type-date',
          maintenance: 'GET /api/v1/inventory/transactions/maintenance/:maintenanceOrderId',
          purchase: 'GET /api/v1/inventory/transactions/purchase/:purchaseOrderId'
        },
        stats: 'GET /api/v1/inventory/stats',
        count: 'POST /api/v1/inventory/count/:partId'
      },
      purchasing: {
        suppliers: {
          list: 'GET /api/v1/purchasing/suppliers',
          create: 'POST /api/v1/purchasing/suppliers',
          get: 'GET /api/v1/purchasing/suppliers/:id',
          update: 'PUT /api/v1/purchasing/suppliers/:id',
          delete: 'DELETE /api/v1/purchasing/suppliers/:id',
          active: 'GET /api/v1/purchasing/suppliers/active',
          taxable: 'GET /api/v1/purchasing/suppliers/taxable',
          type: 'GET /api/v1/purchasing/suppliers/type/:type',
          expiredCommercial: 'GET /api/v1/purchasing/suppliers/expired-commercial',
          stats: 'GET /api/v1/purchasing/suppliers/stats',
          checkExpiry: 'GET /api/v1/purchasing/suppliers/:id/check-expiry',
          rating: 'PUT /api/v1/purchasing/suppliers/:id/rating'
        },
        requests: {
          list: 'GET /api/v1/purchasing/requests',
          create: 'POST /api/v1/purchasing/requests',
          get: 'GET /api/v1/purchasing/requests/:id',
          update: 'PUT /api/v1/purchasing/requests/:id',
          delete: 'DELETE /api/v1/purchasing/requests/:id',
          approve: 'POST /api/v1/purchasing/requests/:id/approve',
          reject: 'POST /api/v1/purchasing/requests/:id/reject',
          byMaintenance: 'GET /api/v1/purchasing/requests/maintenance/:maintenanceOrderId',
          withMaintenance: 'GET /api/v1/purchasing/requests/:id/with-maintenance'
        },
        orders: {
          list: 'GET /api/v1/purchasing/orders',
          create: 'POST /api/v1/purchasing/orders',
          get: 'GET /api/v1/purchasing/orders/:id',
          update: 'PUT /api/v1/purchasing/orders/:id',
          delete: 'DELETE /api/v1/purchasing/orders/:id',
          confirm: 'POST /api/v1/purchasing/orders/:id/confirm',
          cancel: 'POST /api/v1/purchasing/orders/:id/cancel',
          byMaintenance: 'GET /api/v1/purchasing/orders/maintenance/:maintenanceOrderId'
        },
        receiving: {
          list: 'GET /api/v1/purchasing/receiving',
          create: 'POST /api/v1/purchasing/receiving',
          get: 'GET /api/v1/purchasing/receiving/:id',
          update: 'PUT /api/v1/purchasing/receiving/:id',
          delete: 'DELETE /api/v1/purchasing/receiving/:id',
          complete: 'POST /api/v1/purchasing/receiving/:id/complete',
          cancel: 'POST /api/v1/purchasing/receiving/:id/cancel',
          byOrder: 'GET /api/v1/purchasing/receiving/order/:orderId'
        },
        maintenance: {
          createRequest: 'POST /api/v1/purchasing/maintenance/:maintenanceOrderId/create-request',
          createOrder: 'POST /api/v1/purchasing/maintenance/:maintenanceOrderId/create-order',
          createReceiving: 'POST /api/v1/purchasing/maintenance/:maintenanceOrderId/create-receiving'
        }
      },
      suppliers: {
        list: 'GET /api/v1/suppliers',
        create: 'POST /api/v1/suppliers',
        get: 'GET /api/v1/suppliers/:id',
        update: 'PUT /api/v1/suppliers/:id',
        delete: 'DELETE /api/v1/suppliers/:id',
        active: 'GET /api/v1/suppliers/active',
        taxable: 'GET /api/v1/suppliers/taxable',
        type: 'GET /api/v1/suppliers/type/:type',
        expiredCommercial: 'GET /api/v1/suppliers/expired-commercial',
        stats: 'GET /api/v1/suppliers/stats',
        checkExpiry: 'GET /api/v1/suppliers/:id/check-expiry',
        rating: 'PUT /api/v1/suppliers/:id/rating'
      },
      entities: {
        list: 'GET /api/v1/entities',
        create: 'POST /api/v1/entities',
        get: 'GET /api/v1/entities/:id',
        update: 'PUT /api/v1/entities/:id',
        delete: 'DELETE /api/v1/entities/:id',
        active: 'GET /api/v1/entities/active',
        internal: 'GET /api/v1/entities/internal',
        external: 'GET /api/v1/entities/external',
        type: 'GET /api/v1/entities/type/:type',
        category: 'GET /api/v1/entities/category/:category',
        stats: 'GET /api/v1/entities/stats'
      },
      trusts: {
        list: 'GET /api/v1/trusts',
        create: 'POST /api/v1/trusts',
        get: 'GET /api/v1/trusts/:id',
        update: 'PUT /api/v1/trusts/:id',
        delete: 'DELETE /api/v1/trusts/:id',
        active: 'GET /api/v1/trusts/active',
        overdue: 'GET /api/v1/trusts/overdue',
        stats: 'GET /api/v1/trusts/stats',
        return: 'POST /api/v1/trusts/:id/return',
        cancel: 'POST /api/v1/trusts/:id/cancel',
        byTrustee: 'GET /api/v1/trusts/trustee/:trusteeId',
        byStatus: 'GET /api/v1/trusts/status/:status'
      },
      // ✅ Employees — أصحاب العهد (السائقين + أي موظف آخر)
      employees: {
        list: 'GET /api/v1/employees',
        create: 'POST /api/v1/employees',
        get: 'GET /api/v1/employees/:id',
        update: 'PUT /api/v1/employees/:id',
        delete: 'DELETE /api/v1/employees/:id',
        trustEligible: 'GET /api/v1/employees/trust-eligible',
        byStatus: 'GET /api/v1/employees/status/:status'
      },
      reports: {
        list: 'GET /api/v1/reports',
        create: 'POST /api/v1/reports',
        get: 'GET /api/v1/reports/:id',
        update: 'PUT /api/v1/reports/:id',
        delete: 'DELETE /api/v1/reports/:id',
        generate: 'POST /api/v1/reports/generate',
        export: 'GET /api/v1/reports/:id/export',
        // Maintenance Reports
        maintenance: 'GET /api/v1/reports/maintenance/:startDate/:endDate',
        maintenanceExcel: 'GET /api/v1/reports/maintenance/:startDate/:endDate/excel',
        maintenancePDF: 'GET /api/v1/reports/maintenance/:startDate/:endDate/pdf',
        // Parts Reports
        parts: 'GET /api/v1/reports/parts/:startDate/:endDate',
        partsExcel: 'GET /api/v1/reports/parts/:startDate/:endDate/excel',
        partsPDF: 'GET /api/v1/reports/parts/:startDate/:endDate/pdf',
        // Cost Reports
        cost: 'GET /api/v1/reports/cost/:startDate/:endDate',
        costExcel: 'GET /api/v1/reports/cost/:startDate/:endDate/excel',
        costPDF: 'GET /api/v1/reports/cost/:startDate/:endDate/pdf',
        // Fuel Reports
        fuel: 'GET /api/v1/reports/fuel/:startDate/:endDate',
        fuelExcel: 'GET /api/v1/reports/fuel/:startDate/:endDate/excel',
        fuelPDF: 'GET /api/v1/reports/fuel/:startDate/:endDate/pdf',
        // Vehicles Reports
        vehicles: 'GET /api/v1/reports/vehicles/:startDate/:endDate',
        vehiclesExcel: 'GET /api/v1/reports/vehicles/:startDate/:endDate/excel',
        vehiclesPDF: 'GET /api/v1/reports/vehicles/:startDate/:endDate/pdf',
        // Missions Reports
        missions: 'GET /api/v1/reports/missions/:startDate/:endDate',
        missionsExcel: 'GET /api/v1/reports/missions/:startDate/:endDate/excel',
        missionsPDF: 'GET /api/v1/reports/missions/:startDate/:endDate/pdf',
        // Inventory Reports
        inventory: 'GET /api/v1/reports/inventory/:startDate/:endDate',
        inventoryExcel: 'GET /api/v1/reports/inventory/:startDate/:endDate/excel',
        inventoryPDF: 'GET /api/v1/reports/inventory/:startDate/:endDate/pdf',
        // Purchasing Reports
        purchasing: 'GET /api/v1/reports/purchasing/:startDate/:endDate',
        purchasingExcel: 'GET /api/v1/reports/purchasing/:startDate/:endDate/excel',
        purchasingPDF: 'GET /api/v1/reports/purchasing/:startDate/:endDate/pdf',
        // Top Reports
        topCost: 'GET /api/v1/reports/topCost/:startDate/:endDate',
        topCostExcel: 'GET /api/v1/reports/topCost/:startDate/:endDate/excel',
        topCostPDF: 'GET /api/v1/reports/topCost/:startDate/:endDate/pdf',
        topFuel: 'GET /api/v1/reports/topFuel/:startDate/:endDate',
        topFuelExcel: 'GET /api/v1/reports/topFuel/:startDate/:endDate/excel',
        topFuelPDF: 'GET /api/v1/reports/topFuel/:startDate/:endDate/pdf',
        frequentIssues: 'GET /api/v1/reports/frequentIssues/:startDate/:endDate',
        frequentIssuesExcel: 'GET /api/v1/reports/frequentIssues/:startDate/:endDate/excel',
        frequentIssuesPDF: 'GET /api/v1/reports/frequentIssues/:startDate/:endDate/pdf',
        expenses: 'GET /api/v1/reports/expenses/:startDate/:endDate',
        expensesExcel: 'GET /api/v1/reports/expenses/:startDate/:endDate/excel',
        expensesPDF: 'GET /api/v1/reports/expenses/:startDate/:endDate/pdf',
        // Fleet Reports
        bus: 'GET /api/v1/reports/vehicles/bus',
        busExcel: 'GET /api/v1/reports/vehicles/bus/excel',
        busPDF: 'GET /api/v1/reports/vehicles/bus/pdf',
        truck: 'GET /api/v1/reports/vehicles/truck',
        truckExcel: 'GET /api/v1/reports/vehicles/truck/excel',
        truckPDF: 'GET /api/v1/reports/vehicles/truck/pdf',
        private: 'GET /api/v1/reports/vehicles/private',
        privateExcel: 'GET /api/v1/reports/vehicles/private/excel',
        privatePDF: 'GET /api/v1/reports/vehicles/private/pdf',
        fuelCards: 'GET /api/v1/reports/fuel-cards',
        fuelCardsExcel: 'GET /api/v1/reports/fuel-cards/excel',
        fuelCardsPDF: 'GET /api/v1/reports/fuel-cards/pdf',
        rentals: 'GET /api/v1/reports/rentals',
        rentalsExcel: 'GET /api/v1/reports/rentals/excel',
        rentalsPDF: 'GET /api/v1/reports/rentals/pdf',
        movement: 'GET /api/v1/reports/movement',
        movementExcel: 'GET /api/v1/reports/movement/excel',
        movementPDF: 'GET /api/v1/reports/movement/pdf',
        // Full Report
        full: 'GET /api/v1/reports/full/:startDate/:endDate',
        fullExcel: 'GET /api/v1/reports/full/:startDate/:endDate/excel',
        fullPDF: 'GET /api/v1/reports/full/:startDate/:endDate/pdf',
        // ============================================================
        // ✅ تقرير السيارة الشامل (Vehicle Full Report)
        // ============================================================
        vehicleFullReport: 'GET /api/v1/reports/vehicle/:vehicleId/full-report',
        vehicleFullReportExcel: 'GET /api/v1/reports/vehicle/:vehicleId/full-report/excel',
        vehicleFullReportPDF: 'GET /api/v1/reports/vehicle/:vehicleId/full-report/pdf',
        // ============================================================
        // ✅ تقرير السائقين (إيجارات) — داخلي / خارجي / مبيت
        // ============================================================
        driversRentalSummary: 'GET /api/v1/reports/drivers/rental-summary',
        driversRentalSummaryExcel: 'GET /api/v1/reports/drivers/rental-summary/excel',
        // ============================================================
        // ✅ تقرير استهلاك الكروت + إجمالي الوقود
        // ============================================================
        fuelCardsConsumptionExcel: 'GET /api/v1/reports/fuel/cards-consumption/excel'
      },
      notifications: {
        list: 'GET /api/v1/notifications',
        create: 'POST /api/v1/notifications',
        unread: 'GET /api/v1/notifications/unread',
        unreadCount: 'GET /api/v1/notifications/unread/count',
        markRead: 'PUT /api/v1/notifications/:id/read',
        markAllRead: 'PUT /api/v1/notifications/read-all',
        delete: 'DELETE /api/v1/notifications/:id',
        preferences: 'GET /api/v1/notifications/preferences',
        updatePreferences: 'PUT /api/v1/notifications/preferences',
        registerDevice: 'POST /api/v1/notifications/devices',
        unregisterDevice: 'DELETE /api/v1/notifications/devices',
        sendPush: 'POST /api/v1/notifications/push'
      },
      settings: {
        list: 'GET /api/v1/settings',
        create: 'POST /api/v1/settings',
        get: 'GET /api/v1/settings/:id',
        update: 'PUT /api/v1/settings/:id',
        delete: 'DELETE /api/v1/settings/:id',
        byKey: 'GET /api/v1/settings/key/:key',
        byCategory: 'GET /api/v1/settings/category/:category',
        grouped: 'GET /api/v1/settings/grouped',
        public: 'GET /api/v1/settings/public'
      },
      audit: {
        list: 'GET /api/v1/audit',
        get: 'GET /api/v1/audit/:id',
        delete: 'DELETE /api/v1/audit/:id'
      },
      contracts: {
        list: 'GET /api/v1/contracts',
        create: 'POST /api/v1/contracts',
        get: 'GET /api/v1/contracts/:id',
        update: 'PUT /api/v1/contracts/:id',
        delete: 'DELETE /api/v1/contracts/:id',
        activate: 'POST /api/v1/contracts/:id/activate',
        cancel: 'POST /api/v1/contracts/:id/cancel',
        renew: 'POST /api/v1/contracts/:id/renew',
        active: 'GET /api/v1/contracts/active',
        expired: 'GET /api/v1/contracts/expired',
        expiring: 'GET /api/v1/contracts/expiring/:days',
        type: 'GET /api/v1/contracts/type/:type',
        status: 'GET /api/v1/contracts/status/:status'
      },
      insurance: {
        list: 'GET /api/v1/insurance',
        create: 'POST /api/v1/insurance',
        get: 'GET /api/v1/insurance/:id',
        update: 'PUT /api/v1/insurance/:id',
        delete: 'DELETE /api/v1/insurance/:id',
        renew: 'POST /api/v1/insurance/:id/renew',
        cancel: 'POST /api/v1/insurance/:id/cancel',
        claims: 'POST /api/v1/insurance/:id/claims',
        active: 'GET /api/v1/insurance/active',
        expired: 'GET /api/v1/insurance/expired',
        expiring: 'GET /api/v1/insurance/expiring/:days',
        status: 'GET /api/v1/insurance/status/:status',
        vehicle: 'GET /api/v1/insurance/vehicle/:vehicleId',
        vehicleActive: 'GET /api/v1/insurance/vehicle/:vehicleId/active'
      },
      accidents: {
        list: 'GET /api/v1/accidents',
        create: 'POST /api/v1/accidents',
        get: 'GET /api/v1/accidents/:id',
        update: 'PUT /api/v1/accidents/:id',
        delete: 'DELETE /api/v1/accidents/:id',
        stats: 'GET /api/v1/accidents/stats',
        status: 'GET /api/v1/accidents/status/:status',
        severity: 'GET /api/v1/accidents/severity/:severity',
        vehicle: 'GET /api/v1/accidents/vehicle/:vehicleId',
        driver: 'GET /api/v1/accidents/driver/:driverId',
        updateStatus: 'PATCH /api/v1/accidents/:id/status',
        updateRepairStatus: 'PATCH /api/v1/accidents/:id/repair-status'
      },
      violations: {
        list: 'GET /api/v1/violations',
        create: 'POST /api/v1/violations',
        get: 'GET /api/v1/violations/:id',
        update: 'PUT /api/v1/violations/:id',
        delete: 'DELETE /api/v1/violations/:id',
        stats: 'GET /api/v1/violations/stats',
        status: 'GET /api/v1/violations/status/:status',
        type: 'GET /api/v1/violations/type/:type',
        vehicle: 'GET /api/v1/violations/vehicle/:vehicleId',
        driver: 'GET /api/v1/violations/driver/:driverId',
        updateStatus: 'PATCH /api/v1/violations/:id/status',
        pay: 'POST /api/v1/violations/:id/pay'
      },
      workflow: {
        list: 'GET /api/v1/workflow',
        create: 'POST /api/v1/workflow',
        get: 'GET /api/v1/workflow/:id',
        update: 'PUT /api/v1/workflow/:id',
        delete: 'DELETE /api/v1/workflow/:id',
        activate: 'POST /api/v1/workflow/:id/activate',
        deactivate: 'POST /api/v1/workflow/:id/deactivate',
        active: 'GET /api/v1/workflow/active',
        module: 'GET /api/v1/workflow/module/:module',
        instances: 'GET /api/v1/workflow/instances',
        instance: 'GET /api/v1/workflow/instances/:id',
        instanceByRecord: 'GET /api/v1/workflow/instances/record/:recordId',
        start: 'POST /api/v1/workflow/:id/start',
        approveStep: 'POST /api/v1/workflow/instances/:instanceId/steps/:stepId/approve',
        rejectStep: 'POST /api/v1/workflow/instances/:instanceId/steps/:stepId/reject'
      },
      rules: {
        list: 'GET /api/v1/rules',
        create: 'POST /api/v1/rules',
        get: 'GET /api/v1/rules/:id',
        update: 'PUT /api/v1/rules/:id',
        delete: 'DELETE /api/v1/rules/:id',
        activate: 'POST /api/v1/rules/:id/activate',
        deactivate: 'POST /api/v1/rules/:id/deactivate',
        active: 'GET /api/v1/rules/active',
        module: 'GET /api/v1/rules/module/:module',
        type: 'GET /api/v1/rules/type/:type',
        stats: 'GET /api/v1/rules/stats',
        evaluate: 'POST /api/v1/rules/:id/evaluate',
        evaluateAll: 'POST /api/v1/rules/module/:module/evaluate'
      },
      users: {
        list: 'GET /api/v1/users',
        create: 'POST /api/v1/users',
        get: 'GET /api/v1/users/:id',
        update: 'PUT /api/v1/users/:id',
        delete: 'DELETE /api/v1/users/:id',
        profile: 'GET /api/v1/users/profile',
        changePassword: 'POST /api/v1/users/:id/change-password',
        updateStatus: 'PATCH /api/v1/users/:id/status',
        updateRoles: 'PATCH /api/v1/users/:id/roles',
        status: 'GET /api/v1/users/status/:status',
        role: 'GET /api/v1/users/role/:role'
      }
    }
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path
  });
});

// Error Handler
app.use(errorHandler);

// ============================================================
// ✅ حماية من التوقف المفاجئ (Crash Safety)
// ============================================================
// قبل كده أي خطأ غير متوقع (Promise rejected من غير catch، أو exception
// حصل برا middleware الـ Express) كان ممكن يوقف السيرفر بالكامل ويحتاج
// إعادة تشغيل يدوي. دلوقتي بنسجل الخطأ في اللوج ونكمّل شغل، بدل ما
// نوقف الخدمة كلها بسبب طلب واحد فشل.
// ============================================================
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Promise Rejection: ${reason instanceof Error ? reason.stack || reason.message : reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.stack || error.message}`);
  // ملحوظة: مفيش process.exit() هنا عمدًا عشان السيرفر يفضل شغال
  // ويستمر في خدمة باقي الطلبات بدل ما يقف بالكامل.
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`🚀 FleetERP Backend running on port ${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API: http://localhost:${PORT}/api/v1`);
  console.log(`❤️ Health: http://localhost:${PORT}/health`);
  console.log(`📦 Modules: 25 loaded`);
  console.log(`🌐 CORS: All origins allowed (development mode)`);
});

// ✅ لو البورت مشغول أو في مشكلة تانية وقت الإقلاع، نسجلها بوضوح بدل
// ما السيرفر يوقع بغير ما نعرف السبب.
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use.`);
  } else {
    logger.error(`Server failed to start: ${error.message}`);
  }
  process.exit(1);
});

// ✅ إغلاق نظيف عند إيقاف الخدمة (pm2 / docker / systemctl) بدل ما تتقطع
// الطلبات الجارية فجأة.
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
  // لو في طلبات معلّقة مش هتخلص، منسبش السيرفر يفضل معلّق للأبد
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
