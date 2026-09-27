import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { runWithRequestContext } from '../utils/request-context';
import { hasReadDependencyOn, hasCreateDependencyOn, hasWriteDependencyOn } from '../constants/pages';
import { UserRepository } from '../../modules/users/repositories/user.repository';

// ✅ FIX: التوكن (JWT) بيحمل نسخة من roles/permissions/allowedPages وقت تسجيل
// الدخول بس. لما السوبر أدمن يغيّر صلاحيات حساب (مثلاً يفعّله على صفحة
// "السائقين") من لوحة التحكم، الحساب ده كان لازم يعمل تسجيل خروج/دخول من
// جديد عشان التغيير يشتغل، وإلا التوكن القديم يفضل شايل allowedPages
// القديمة ويرجّع 403 "ملكش صلاحية" حتى بعد ما الصلاحية اتضافتله فعلاً.
// دلوقتي authenticate() بيجيب أحدث بيانات الحساب من قاعدة البيانات في كل
// طلب (roles/permissions/allowedPages/status)، فأي تغيير في الصلاحيات
// بيشتغل فورًا من غير ما نحتاج تسجيل خروج/دخول.
const userRepo = new UserRepository();

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username?: string;
        roles: string[];
        permissions: string[];
        allowedPages?: string[];
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // ✅ تحسين أداء: بعض المسارات بتحط authenticate مرتين على نفس الطلب
  // (مرة عامة في index.ts قبل requirePageAccess، ومرة جوه الراوتر الداخلي
  // للموديول نفسه). لو الطلب ده خلاص اتعمله authenticate قبل كده (req.user
  // موجود بالفعل)، معنى كده إحنا فعلاً فكينا التوكن وجبنا بيانات المستخدم
  // وحطينا الـ request context. مفيش داعي نكرر فك التوكن + قراءة المستخدم
  // من قاعدة البيانات تاني لنفس الطلب بالظبط — ده كان بيضاعف زمن كل طلب
  // وعدد قراءات Firestore من غير أي فايدة إضافية.
  if (req.user) {
    next();
    return;
  }

  try {
    let token = null;

    // ✅ 1. حاول الحصول على التوكن من Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // ✅ 2. لو مش موجود في Header، حاول من الـ Query Parameter
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    // ✅ 3. لو مش موجود، حاول من الـ Body (للـ POST requests)
    if (!token && req.body?.token) {
      token = req.body.token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: No token provided'
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;

    // ✅ الافتراضي: بيانات التوكن (fallback لو الحساب اتمسح أو الداتابيز
    // معلّقة مؤقتًا، عشان لو حصل خطأ في الجلب منعملش قطع كامل للخدمة).
    let roles = decoded.roles || [];
    let permissions = decoded.permissions || [];
    let allowedPages = decoded.allowedPages || [];

    try {
      const freshUser = await userRepo.findById(decoded.id);
      if (!freshUser || freshUser.isDeleted) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: الحساب لم يعد موجودًا'
        });
        return;
      }
      if (freshUser.status !== 'active') {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: الحساب غير نشط حاليًا'
        });
        return;
      }
      // ✅ أحدث نسخة من الصلاحيات من قاعدة البيانات بدل نسخة التوكن القديمة
      roles = freshUser.roles || [];
      permissions = freshUser.permissions || [];
      allowedPages = freshUser.allowedPages || [];
    } catch (lookupError) {
      // ✅ الداتابيز معلّقة مؤقتًا: نكمل بصلاحيات التوكن القديمة بدل ما
      // نرفض كل الطلبات، ونسجّل تحذير عشان يتراجع لاحقًا.
      logger.warn(`Could not refresh user permissions from DB, falling back to token claims: ${lookupError}`);
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username,
      roles,
      permissions,
      allowedPages
    };

    logger.debug(`User authenticated: ${decoded.email}`);

    // ✅ FIX: تسجيل بيانات المستخدم الحالي في "سياق الطلب" (Request Context)
    // عشان سجل العمليات (Audit Log) يقدر يعرف مين اللي بيعمل التعديل من غير
    // ما نحتاج نمرر req لكل service/repository في النظام. من غير الخطوة دي
    // كل عملية كانت بتتسجل بـ "غير معروف" لأن مفيش حد بيبعت userId/username.
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || req.ip;

    runWithRequestContext(
      {
        userId: decoded.id,
        username: decoded.username || decoded.email,
        ipAddress,
        userAgent: req.headers['user-agent'],
        sessionId: decoded.sessionId
      },
      next
    );
  } catch (error) {
    logger.error(`Authentication error: ${error}`);
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid token'
    });
    return;
  }
};

// ============================================================
// ✅ نظام الصلاحيات بثلاث مستويات: سوبر أدمن / أدمن / مشاهد
// نفس القيم المستخدمة في الفرونت إند (js/components/sidebar.js).
// عشان لو حد نادى الـ API مباشرة (Postman / من الكونسول) من غير
// ما يعدي على الواجهة، السيرفر برضه يرفض أي تعديل من حساب مش مصرّح له.
//
// - سوبر أدمن (superadmin): يشوف ويعدّل كل صفحات النظام + لوحة
//   التحكم بالحسابات والصلاحيات (users/settings/audit/rules/workflow).
// - أدمن (admin): يشوف ويعدّل بس الصفحات اللي السوبر أدمن فعّلها له
//   (allowedPages)، ومش قادر يدخل لوحة التحكم بالحسابات.
// - مشاهد (viewer): يشوف بس الصفحات المفعّلة له (allowedPages) ومش
//   قادر يعدّل/يضيف/يحذف أي حاجة في أي صفحة.
// ============================================================
export const SUPERADMIN_ROLE_VALUES = [
  'superadmin',
  'super_admin',
  'سوبر ادمن',
  'سوبر أدمن',
  'مدير النظام'
];

export const ADMIN_ROLE_VALUES = [
  'admin',
  'ادمن',
  'أدمن',
  'مدير'
];

export const VIEWER_ROLE_VALUES = [
  'viewer',
  'مشاهد',
  'مشاهدة'
];

// ✅ إبقاء الاسم القديم كمرجع (مطابق للأدمن + السوبر أدمن سوا) عشان أي
// كود قديم بيستورد ADMIN_ROLE_VALUES القديمة (اللي كانت شاملة الاتنين)
// يفضل شغال زي ما هو.
export const LEGACY_FULL_ACCESS_ROLE_VALUES = [
  ...SUPERADMIN_ROLE_VALUES,
  ...ADMIN_ROLE_VALUES
];

const normalizedRoles = (user?: { roles?: string[] }): string[] => {
  if (!user || !Array.isArray(user.roles)) return [];
  return user.roles.map(role => String(role).toLowerCase().trim());
};

export const isSuperAdmin = (user?: { roles?: string[] }): boolean => {
  const roles = normalizedRoles(user);
  return roles.some(role => SUPERADMIN_ROLE_VALUES.includes(role));
};

export const isAdminRole = (user?: { roles?: string[] }): boolean => {
  const roles = normalizedRoles(user);
  return roles.some(role => ADMIN_ROLE_VALUES.includes(role));
};

export const isViewerRole = (user?: { roles?: string[] }): boolean => {
  const roles = normalizedRoles(user);
  return roles.some(role => VIEWER_ROLE_VALUES.includes(role));
};

/**
 * ✅ أي حساب معاه صلاحية تعديل في الأساس (سوبر أدمن أو أدمن)، بغض النظر
 * عن كونها مقصورة على صفحات معينة أو لا. مستخدمة في الفحوصات العامة
 * اللي مش مرتبطة بصفحة بعينها (requirePermission / requireRole).
 */
export const isAdminUser = (user?: { roles?: string[] }): boolean => {
  return isSuperAdmin(user) || isAdminRole(user);
};

/**
 * ✅ Middleware يسمح فقط لحساب السوبر أدمن بالمرور (لوحة التحكم بالحسابات،
 * الإعدادات العامة، سجل العمليات... إلخ). حساب الأدمن (المقصور على صفحات
 * معينة) والمشاهد هيرجعلهم السيرفر 403.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: User not authenticated'
    });
    return;
  }

  if (!isSuperAdmin(req.user)) {
    res.status(403).json({
      success: false,
      message: 'Forbidden: هذه الصلاحية للسوبر أدمن فقط'
    });
    return;
  }

  next();
};

// ✅ طلب قراءة فقط (مافيهوش أي تعديل على البيانات)
const isReadRequest = (req: Request): boolean =>
  req.method === 'GET' || req.method === 'HEAD';

// ✅ طلب إنشاء سجل جديد في جذر الموديول (POST /api/v1/<module>)
// req.path هنا نسبي لنقطة التركيب، فبيبقى '/' لو الطلب على الجذر مباشرة.
const isRootCreateRequest = (req: Request): boolean =>
  req.method === 'POST' && (req.path === '/' || req.path === '');

/**
 * ✅ Middleware التعديل على مستوى الصفحة: بيسمح للسوبر أدمن دايمًا،
 * وبيسمح لحساب الأدمن بس لو الصفحة دي (pageId) من ضمن allowedPages
 * بتاعته. حساب المشاهد بيترفض دايمًا حتى لو الصفحة مفتوحة له للعرض.
 */
export const requireEditAccess = (pageId: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated'
      });
      return;
    }

    // ✅ السوبر أدمن يعدّل في كل الصفحات بدون استثناء
    if (isSuperAdmin(req.user)) {
      next();
      return;
    }

    // ✅ الأدمن يعدّل بس في الصفحات المفتوحة له من السوبر أدمن
    if (isAdminRole(req.user)) {
      const allowedPages = req.user.allowedPages || [];
      if (allowedPages.includes(pageId)) {
        next();
        return;
      }
      // ✅ استثناء الإنشاء فقط (راجع PAGE_CREATE_DEPENDENCIES): حساب التقويم
      // يقدر يعمل POST / على المأموريات والإيجارات عشان الإنشاء التلقائي.
      if (isRootCreateRequest(req) && hasCreateDependencyOn(allowedPages, pageId)) {
        next();
        return;
      }
      // ✅ استثناء الكتابات المحددة بين الصيانة والمشتريات والمخازن (راجع
      // PAGE_WRITE_DEPENDENCIES): method + مسار بالظبط، للأدمن بس.
      if (hasWriteDependencyOn(allowedPages, pageId, req.method, req.path)) {
        next();
        return;
      }
      res.status(403).json({
        success: false,
        message: 'Forbidden: ليس لديك صلاحية التعديل في هذه الصفحة'
      });
      return;
    }

    // ✅ المشاهد (أو أي حساب من غير دور تعديل) يترفض دايمًا
    res.status(403).json({
      success: false,
      message: 'Forbidden: هذا الحساب للمشاهدة فقط ولا يملك صلاحية التعديل'
    });
  };
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated'
      });
      return;
    }

    // ✅ السوبر أدمن والأدمن يتخطوا أي فحص صلاحيات تفصيلية تلقائياً
    // (الفحص الأدق على مستوى الصفحة بيتم قبل كده في requireEditAccess)
    if (isAdminUser(req.user)) {
      next();
      return;
    }

    if (!req.user.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Required permission '${permission}'`
      });
      return;
    }

    next();
  };
};

// ============================================================
// ✅ صلاحيات الصفحات (Super Admin Control Panel)
// كل صفحة في النظام ليها "id" ثابت (نفس اسم الموديول في الراوت).
// أي حساب مش سوبر أدمن (أدمن أو مشاهد) لازم يكون معاه allowedPages
// شاملة الـ id ده عشان يقدر يستخدم الـ API بتاع الصفحة دي، حتى لو
// نادى عليه مباشرة من غير ما يعدي على الواجهة (Postman / console).
//
// ✅ ثلاث استثناءات مقصودة (راجع core/constants/pages.ts):
//  1) اعتماديات القراءة: صفحة زي التقويم بتعرض مأموريات/إيجارات/سيارات...
//     فالحساب اللي معاه التقويم بس يقدر يعمل GET على موديولات الصفحات دي
//     (قراءة فقط) عشان الصفحة تتحمّل كاملة.
//  2) إنشاء سجل جديد فقط (POST /) للأدمن: التقويم → مأموريات/إيجارات.
//  3) كتابات محددة (method + مسار) للأدمن بين الصيانة والمشتريات والمخازن
//     (PAGE_WRITE_DEPENDENCIES).
// ============================================================
export const requirePageAccess = (pageId: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated'
      });
      return;
    }

    // ✅ السوبر أدمن يشوف كل الصفحات بدون استثناء
    if (isSuperAdmin(req.user)) {
      next();
      return;
    }

    // ✅ الأدمن والمشاهد لازم تكون الصفحة دي مفتوحة لهم صراحةً...
    const allowedPages = req.user.allowedPages || [];
    if (allowedPages.includes(pageId)) {
      next();
      return;
    }

    // ✅ ...أو تكون صفحة من صفحاتهم المفتوحة محتاجة تقرأ بياناتها
    // (مثلًا: التقويم بيعرض المأموريات والإيجارات). قراءة فقط (GET/HEAD)،
    // وأي تعديل لسه محتاج صلاحية الصفحة نفسها. راجع PAGE_READ_DEPENDENCIES.
    if (isReadRequest(req) && hasReadDependencyOn(allowedPages, pageId, req.path)) {
      next();
      return;
    }

    // ✅ استثناء الإنشاء فقط للأدمن (مش المشاهد): راجع PAGE_CREATE_DEPENDENCIES
    if (isRootCreateRequest(req) && isAdminRole(req.user) && hasCreateDependencyOn(allowedPages, pageId)) {
      next();
      return;
    }

    // ✅ استثناء الكتابات المحددة بين الصيانة والمشتريات والمخازن للأدمن (مش
    // المشاهد): method + مسار بالظبط. راجع PAGE_WRITE_DEPENDENCIES
    if (isAdminRole(req.user) && hasWriteDependencyOn(allowedPages, pageId, req.method, req.path)) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: 'Forbidden: ليس لديك صلاحية الوصول إلى هذه الصفحة'
    });
  };
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated'
      });
      return;
    }

    // ✅ السوبر أدمن والأدمن يتخطوا أي فحص دور تفصيلي تلقائياً
    if (isAdminUser(req.user)) {
      next();
      return;
    }

    const hasRole = req.user.roles.some(role => roles.includes(role));
    if (!hasRole) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Required role '${roles.join(', ')}'`
      });
      return;
    }

    next();
  };
};