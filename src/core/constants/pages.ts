// ============================================================
// ✅ سجل صفحات النظام (Pages Registry)
// المصدر الوحيد لقائمة الصفحات اللي السوبر أدمن يقدر يفعّلها/يعطّلها
// لكل حساب من لوحة التحكم. الـ id هنا لازم يطابق تمامًا اسم الموديول
// في الراوت (app.use('/api/v1/<id>', ...)) عشان requirePageAccess()
// يشتغل صح تلقائيًا.
// ============================================================

export interface PageDefinition {
  id: string;
  label: string;
  group: string;
}

export const PAGE_REGISTRY: PageDefinition[] = [
  { id: 'vehicles',       label: 'السيارات',       group: 'الأسطول' },
  { id: 'drivers',        label: 'السائقين',       group: 'الأسطول' },
  { id: 'employees',      label: 'الموظفون',       group: 'الأسطول' },
  { id: 'missions',       label: 'المأموريات',     group: 'العمليات' },
  { id: 'rentals',        label: 'الإيجارات',      group: 'العمليات' },
  { id: 'calendar-plans', label: 'التقويم',        group: 'العمليات' },
  { id: 'fuel',           label: 'الوقود',         group: 'العمليات' },
  { id: 'maintenance',    label: 'الصيانة',        group: 'العمليات' },
  { id: 'inventory',      label: 'المخازن',        group: 'المخازن والمشتريات' },
  { id: 'purchasing',     label: 'المشتريات',      group: 'المخازن والمشتريات' },
  { id: 'suppliers',      label: 'الموردين',       group: 'المخازن والمشتريات' },
  { id: 'entities',       label: 'العملاء / الجهات', group: 'إدارية' },
  { id: 'trusts',         label: 'العهد',          group: 'إدارية' },
  { id: 'contracts',      label: 'العقود',         group: 'إدارية' },
  { id: 'insurance',      label: 'التأمين',        group: 'إدارية' },
  { id: 'accidents',      label: 'الحوادث',        group: 'إدارية' },
  { id: 'violations',     label: 'المخالفات',      group: 'إدارية' },
  { id: 'reports',        label: 'التقارير',       group: 'تقارير' },
];

export const PAGE_IDS = PAGE_REGISTRY.map(p => p.id);

// ============================================================
// ✅ اعتماديات القراءة بين الصفحات (Read-only Page Dependencies)
// ------------------------------------------------------------
// المشكلة اللي بتحلها: صفحة زي "التقويم" بتعرض بيانات من المأموريات
// والإيجارات والسيارات والسائقين والعملاء. لو الحساب معاه صلاحية
// التقويم بس، الـ API بتاع المأموريات/الإيجارات/... كان بيرجّع 403
// والصفحة تطلع ناقصة.
//
// الحل: كل صفحة هنا بتعلن (KEY) إنها محتاجة تقرأ بيانات من صفحات
// تانية (VALUES). أي حساب معاه الصفحة الأولى في allowedPages يقدر
// يعمل طلبات قراءة فقط (GET / HEAD) على موديولات الصفحات التانية دي،
// من غير ما تظهر له الصفحات دي في القائمة الجانبية ومن غير أي صلاحية
// تعديل عليها. أي POST / PUT / PATCH / DELETE لسه محتاج صلاحية الصفحة
// الفعلية زي الأول (إلا الاستثناءات الضيقة تحت: PAGE_CREATE_DEPENDENCIES
// و PAGE_WRITE_DEPENDENCIES).
//
// القاعدة عند إضافة صفحة/ميزة جديدة: لو الصفحة بتنادي API بتاع موديول
// تاني عشان تعرض بياناته (قوائم اختيار، أسماء، إحصائيات...) ضيف الـ id
// بتاعه هنا. (الـ ids لازم تطابق PAGE_REGISTRY فوق.)
// ============================================================
// عنصر الاعتماد: إما id الصفحة كاملة (كل GET على الموديول بتاعها)، أو
// { page, paths } لو عايزين نحصر القراءة في مسارات معينة جوه الموديول
// (مستخدمة مع "reports" لأنه موديول واسع فيه تقارير مالية مالهاش علاقة
// بصفحة السيارات/السائقين، فمانفتحش منه غير تقرير السيارة/السائق الشامل).
export type PageDependency = string | { page: string; paths: string[] };

export const PAGE_READ_DEPENDENCIES: Record<string, PageDependency[]> = {
  // الأسطول
  'vehicles':       [{ page: 'reports', paths: ['/vehicle/'] }],                                        // تقرير السيارة الشامل (JSON / Excel / PDF)
  'drivers':        [{ page: 'reports', paths: ['/driver/', '/drivers/full-report/'] }],               // تقرير السائق / السائقين الشامل
  'employees':      [],

  // العمليات
  'missions':       ['vehicles', 'drivers', 'entities'],
  'rentals':        ['vehicles', 'drivers', 'entities'],
  'calendar-plans': ['missions', 'rentals', 'vehicles', 'drivers', 'entities'],
  'fuel':           ['vehicles', 'drivers'],
  'maintenance':    ['vehicles', 'inventory', 'purchasing', 'suppliers'],

  // المخازن والمشتريات
  'inventory':      [],
  'purchasing':     ['inventory', 'maintenance', 'suppliers', 'vehicles'],
  'suppliers':      [],

  // إدارية
  'entities':       [],
  'trusts':         ['drivers', 'employees'],
  'contracts':      ['entities', 'suppliers'],
  'insurance':      ['vehicles'],
  'accidents':      ['vehicles', 'drivers'],
  'violations':     ['vehicles', 'drivers'],

  // تقارير
  'reports':        ['drivers'],
};

// ============================================================
// ✅ اعتماديات الإنشاء (Create-only Page Dependencies)
// ------------------------------------------------------------
// استثناء ضيق جدًا ومقصود: التقويم بيحوّل الموعد أوتوماتيك لمأمورية/
// إيجار "ناقص البيانات" لما يحل تاريخه (ده أساس فكرة التقويم). عشان
// حساب التقويم يقدر يكمّل الدورة دي من غير ما نفتح له صفحة المأموريات
// والإيجارات بالكامل، بنسمح له بس بـ: POST / (إنشاء سجل جديد) للأدمن
// (مش المشاهد). التعديل/الحذف/بدء/إنهاء/إلغاء فضلوا محتاجين صلاحية
// الصفحة الفعلية.
// لو عايز تلغي الاستثناء ده: خلّي الـ object فاضي {}.
// ============================================================
export const PAGE_CREATE_DEPENDENCIES: Record<string, string[]> = {
  'calendar-plans': ['missions', 'rentals'],
};

// ============================================================
// ✅ اعتماديات الكتابة بين الصفحات (Cross-page Write Dependencies)
// ------------------------------------------------------------
// المشكلة اللي بتحلها: صفحات الصيانة والمشتريات والمخازن بتكمّل
// دورة واحدة لبعض من غير ما المستخدم يحس. مثال: من صفحة الصيانة لما
// قطعة الغيار ناقصة بيتعمل طلب شراء أوتوماتيك، ولما القطعة متوفرة
// بتتسحب من المخزن. ومن صفحة المشتريات لما أمر الشراء يتأكد أو يتستلم
// بيتحدّث آخر سعر للقطعة في المخزن. من غير الاستثناء ده كانت الكتابات
// دي بترجع 403 (الحساب معاه الصفحة الأولى بس)، والفرونت إند بيعرض
// توست تحذير ويكمّل من غير ما الصفحة تتكسر، لكن الدورة بتفضل ناقصة.
//
// الحل: كل صفحة (KEY) بتعلن قائمة ضيقة جدًا من الكتابات (VALUES) على
// موديولات تانية، محددة بالـ method وبمسار الطلب بالظبط (نسبةً لنقطة
// التركيب /api/v1/<page>). الاستثناء ده للأدمن اللي معاه الصفحة الأولى
// في allowedPages فقط — المشاهد بيترفض دايمًا — وأي كتابة تانية على
// الموديولات دي (حذف، اعتماد، تأكيد، إنشاء مورد/مخزن...) لسه محتاجة
// صلاحية الصفحة الفعلية زي الأول.
//
// القاعدة عند إضافة ميزة جديدة: لو صفحة بتكتب في موديول تاني كجزء من
// نفس الدورة، ضيف الـ method والمسار هنا. لو عايز تلغي الاستثناء ده
// كله: خلّي الـ object فاضي {}.
// ============================================================
export interface WriteDependency {
  /** id الصفحة/الموديول اللي هيتكتب فيه (لازم يطابق PAGE_REGISTRY) */
  page: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** المسار نسبةً لنقطة التركيب (نفس req.path) — لازم يطابق بالكامل (^...$) */
  path: RegExp;
}

export const PAGE_WRITE_DEPENDENCIES: Record<string, WriteDependency[]> = {
  // الصيانة → المشتريات + المخازن
  'maintenance': [
    { page: 'purchasing', method: 'POST', path: /^\/requests\/?$/ },           // POST /purchasing/requests (طلب شراء لقطعة ناقصة)
    { page: 'purchasing', method: 'PUT',  path: /^\/requests\/[^/]+\/?$/ },    // PUT  /purchasing/requests/:id (إضافة أصناف لطلب شراء معلّق)
    { page: 'inventory',  method: 'POST', path: /^\/transactions\/?$/ },        // POST /inventory/transactions (سحب القطعة المستخدمة من المخزن)
  ],

  // المشتريات → المخازن
  'purchasing': [
    { page: 'inventory',  method: 'PUT',  path: /^\/parts\/[^/]+\/?$/ },        // PUT  /inventory/parts/:id (تحديث آخر سعر للقطعة)
  ],
};

/** أسماء الصفحات اللي dependency معيّنة بتشير لها (للعرض في لوحة التحكم) */
export const dependencyPageIds = (deps: PageDependency[] = []): string[] =>
  Array.from(new Set(deps.map(d => (typeof d === 'string' ? d : d.page))));

/**
 * هل أي صفحة من allowedPages بتعلن اعتماد قراءة على pageId؟
 * requestPath: مسار الطلب نسبةً لنقطة التركيب (req.path) — بيُستخدم بس
 * لو الاعتماد محصور في مسارات معينة.
 */
export const hasReadDependencyOn = (
  allowedPages: string[],
  pageId: string,
  requestPath: string = '/'
): boolean =>
  allowedPages.some(p =>
    (PAGE_READ_DEPENDENCIES[p] || []).some(dep => {
      if (typeof dep === 'string') return dep === pageId;
      return dep.page === pageId && dep.paths.some(prefix => requestPath.startsWith(prefix));
    })
  );

/** هل أي صفحة من allowedPages مسموح لها تنشئ سجل جديد في pageId؟ */
export const hasCreateDependencyOn = (allowedPages: string[], pageId: string): boolean =>
  allowedPages.some(p => (PAGE_CREATE_DEPENDENCIES[p] || []).includes(pageId));

/**
 * هل أي صفحة من allowedPages مسموح لها تعمل الكتابة دي (method + مسار) على pageId؟
 * requestPath: مسار الطلب نسبةً لنقطة التركيب (req.path).
 */
export const hasWriteDependencyOn = (
  allowedPages: string[],
  pageId: string,
  method: string,
  requestPath: string
): boolean =>
  allowedPages.some(p =>
    (PAGE_WRITE_DEPENDENCIES[p] || []).some(
      dep => dep.page === pageId && dep.method === method && dep.path.test(requestPath)
    )
  );
