import { AuditLog, CreateAuditDTO } from '../models/audit.model';
import { BaseRepository } from '../../../core/repositories/base.repository';
import { logger } from '../../../core/utils/logger';

// Create a concrete repository class for Audit logs
export class AuditRepository extends BaseRepository<AuditLog> {
  constructor() {
    super('audit_logs');
  }
}

export class AuditService {
  private auditRepo: AuditRepository;

  constructor() {
    this.auditRepo = new AuditRepository();
  }

  async log(data: CreateAuditDTO): Promise<AuditLog> {
    const auditLog = await this.auditRepo.create({
      ...data,
      status: data.status || 'success',
      isDeleted: false
    });

    logger.debug(`Audit log created: ${data.module} - ${data.action}`);
    return auditLog;
  }

  async getLogs(filter?: any): Promise<AuditLog[]> {
    return this.auditRepo.findAll({ filter, sort: { createdAt: 'desc' } });
  }

  /**
   * ✅ FIX (تحديث): صفحة سجل العمليات في الواجهة بتبعت فلاتر (بحث حر،
   * موديول، حالة، نوع عملية، مدى تاريخ) بالإضافة لـ pagination. الفلاتر
   * كانت بتترجم لـ Firestore query (where module/status/... == ...) وبعدين
   * .orderBy('createdAt') بتتحط فوقها. المشكلة إن Firestore بيتطلب composite
   * index لأي استعلام بيجمع بين where على حقل (زي module أو status) و
   * orderBy على حقل تاني (createdAt)، والـ index ده مش موجود في المشروع.
   * الاستعلام كان بيفشل جوه Firestore ويرمي استثناء، وBaseRepository.findAll()
   * بيمسك الاستثناء ده (try/catch) ويرجع [] من غير أي رسالة خطأ واضحة -
   * فكانت النتيجة "لا توجد سجلات" في كل مرة تختار فيها موديول/حالة/نوع
   * عملية معين (بينما "جميع الموديولات" - من غير أي فلتر - شغالة عادي لأنها
   * استعلام orderBy وحيد بيشتغل بالـ index التلقائي). نفس مشكلة
   * findTrustEligible القديمة بالظبط.
   *
   * الحل: نجيب كل السجلات بـ orderBy بس (من غير أي where في الاستعلام نفسه)
   * ونطبّق كل الفلاتر (موديول/حالة/نوع عملية/يوزر/سجل مرجعي/بحث/تاريخ) في
   * الميموري بعد الجلب - بالظبط زي إصلاح findTrustEligible.
   */
  async getLogsFiltered(options: {
    module?: string;
    userId?: string;
    recordId?: string;
    status?: 'success' | 'failure' | 'warning';
    action?: 'create' | 'update' | 'delete';
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: AuditLog[]; total: number; stats: { success: number; failure: number; warning: number } }> {
    let logs = await this.auditRepo.findAll({ sort: { createdAt: 'desc' } });

    // ✅ قائمة "الموديول" في الواجهة فئات منطقية (زي "المخازن" أو "الصيانة")
    // بينما كل فئة منهم فعليًا بتتخزن في أكتر من كولكشن في قاعدة البيانات
    // (مثلاً "الصيانة" = maintenance_orders + workshops + maintenance_types +
    // scheduled_maintenance). فبندعم قيمة module بصيغة قائمة مفصولة بفاصلة.
    if (options.module) {
      const modules = options.module.split(',').map(m => m.trim()).filter(Boolean);
      logs = logs.filter(l => modules.includes(l.module));
    }
    if (options.userId) logs = logs.filter(l => l.userId === options.userId);
    if (options.recordId) logs = logs.filter(l => l.recordId === options.recordId);
    if (options.status) logs = logs.filter(l => l.status === options.status);
    // ✅ FIX: فلتر "نوع العملية" (إضافة/تعديل/حذف) كان مفقود تمامًا رغم إن
    // الحقل action موجود أصلاً في كل سجل - الواجهة دلوقتي بترسله وبيتطبق هنا.
    if (options.action) logs = logs.filter(l => l.action === options.action);

    if (options.dateFrom) {
      const from = new Date(options.dateFrom).getTime();
      logs = logs.filter(l => new Date(l.createdAt).getTime() >= from);
    }
    if (options.dateTo) {
      // نهاية اليوم المحدد عشان اليوم نفسه يتضمن في النتيجة
      const to = new Date(options.dateTo);
      to.setHours(23, 59, 59, 999);
      logs = logs.filter(l => new Date(l.createdAt).getTime() <= to.getTime());
    }
    if (options.search) {
      const term = options.search.toLowerCase();
      logs = logs.filter(l =>
        (l.username || '').toLowerCase().includes(term) ||
        (l.userId || '').toLowerCase().includes(term) ||
        (l.module || '').toLowerCase().includes(term) ||
        (l.action || '').toLowerCase().includes(term) ||
        (l.recordId || '').toLowerCase().includes(term) ||
        (l.recordType || '').toLowerCase().includes(term)
      );
    }

    const stats = { success: 0, failure: 0, warning: 0 };
    logs.forEach(l => {
      if (l.status === 'success') stats.success++;
      else if (l.status === 'failure') stats.failure++;
      else if (l.status === 'warning') stats.warning++;
    });

    const total = logs.length;
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : total || 1;
    const start = (page - 1) * limit;
    const data = logs.slice(start, start + limit);

    return { data, total, stats };
  }

  async getLogsByUser(userId: string): Promise<AuditLog[]> {
    return this.auditRepo.findAll({
      filter: { userId },
      sort: { createdAt: 'desc' }
    });
  }

  async getLogsByModule(module: string): Promise<AuditLog[]> {
    return this.auditRepo.findAll({
      filter: { module },
      sort: { createdAt: 'desc' }
    });
  }

  async getLogsByRecord(recordId: string): Promise<AuditLog[]> {
    return this.auditRepo.findAll({
      filter: { recordId },
      sort: { createdAt: 'desc' }
    });
  }

  async getLog(id: string): Promise<AuditLog | null> {
    return this.auditRepo.findById(id);
  }

  async deleteLog(id: string): Promise<boolean> {
    return this.auditRepo.softDelete(id);
  }
}