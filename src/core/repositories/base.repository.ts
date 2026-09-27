import { getFirestore, D1Database, D1Collection, D1Query } from '../config/d1.config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { getRequestContext } from '../utils/request-context';

// ============================================================
// ✅ FIX: سجل العمليات (Audit Log) كان دايمًا فاضي لأن مفيش أي مكان في
// الكود كان بينادي AuditService.log() فعليًا عند إضافة/تعديل/حذف أي
// سجل في أي موديول. بدل ما نضيف نداء يدوي في عشرات الـ services/controllers
// (احتمال كبير ننسى واحد منهم)، بنعمل التسجيل مركزيًا هنا في BaseRepository
// نفسه، لأن كل موديولات النظام (سيارات/سائقين/وقود/مأموريات/إيجارات/
// صيانة/مخازن/مستخدمين/...إلخ) بترث منه. بالشكل ده أي create/update/delete
// في أي مكان في النظام بيتسجل تلقائيًا في سجل العمليات، مع:
// - مين عمل العملية (من سياق الطلب request-context بدل "غير معروف")
// - فين حصلت (اسم الموديول/الكولكشن + رقم السجل)
// - كانت ايه وبقت ايه (oldData/newData + قائمة الحقول اللي اتغيرت فعليًا)
// ============================================================

// أسماء الكولكشنز المستثناة من التسجيل التلقائي:
// - audit_logs نفسها: عشان منقعش في حلقة لا نهائية (تسجيل audit عن كتابة audit)
// - notifications / push_devices: بيانات نظام مُولّدة تلقائيًا بكثافة عالية
//   (مش "تعديل" قام بيه مستخدم) وتسجيلها هيغرق سجل العمليات بحاجات مالهاش فايدة
const AUDIT_EXCLUDED_COLLECTIONS = new Set(['audit_logs', 'notifications', 'push_devices']);

// حقول حساسة لازم متتسجلش أبدًا في سجل العمليات حتى لو كانت جزء من oldData/newData
const AUDIT_SENSITIVE_FIELDS = new Set(['password', 'passwordHash', 'token', 'refreshToken', 'otp', 'otpCode']);

// حقول تقنية بحتة بنتجاهلها عند حساب "الحقول اللي اتغيرت" لأنها مش تعديل
// منطقي قام بيه المستخدم (بتتغير تلقائيًا مع كل عملية)
const AUDIT_IGNORED_DIFF_FIELDS = new Set(['updatedAt', 'version']);

const sanitizeForAudit = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  const clone: any = Array.isArray(data) ? [...data] : { ...data };
  Object.keys(clone).forEach(key => {
    if (AUDIT_SENSITIVE_FIELDS.has(key)) {
      delete clone[key];
    }
  });
  return clone;
};

const computeAuditChanges = (
  oldData: Record<string, any> | null | undefined,
  newData: Record<string, any> | null | undefined
): Array<{ field: string; oldValue: any; newValue: any }> => {
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
  if (!newData) return changes;

  const fields = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  fields.forEach(field => {
    if (AUDIT_IGNORED_DIFF_FIELDS.has(field)) return;
    const oldValue = oldData ? oldData[field] : undefined;
    const newValue = newData[field];
    // مقارنة بسيطة (JSON) كافية هنا لأن القيم في الأساس بيانات JSON-serializable
    // جاية من Firestore
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({ field, oldValue, newValue });
    }
  });
  return changes;
};

export interface IRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<T[]>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  softDelete(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;
  findOne(filter: FilterOptions): Promise<T | null>;
  count(filter?: FilterOptions): Promise<number>;
  exists(id: string): Promise<boolean>;
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 'asc' | 'desc'>;
  select?: string[];
  filter?: FilterOptions;
}

export interface FilterOptions {
  [key: string]: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    next?: number;
    prev?: number;
  };
}

export abstract class BaseRepository<T> implements IRepository<T> {
  protected collection: D1Collection;
  protected db: D1Database;

  constructor(collectionName: string) {
    this.db = getFirestore();
    this.collection = this.db.collection(collectionName);
  }

  protected getDoc(id: string) {
    return this.collection.doc(id);
  }

  // ✅ AuditService يتحمّل بشكل كسول (lazy require) وقت النداء الفعلي مش وقت
  // تحميل الملف، عشان نتفادى circular import (audit.service.ts نفسه بيستورد
  // BaseRepository عشان AuditRepository يورث منه).
  private static _auditServiceInstance: any = null;
  private static getAuditServiceInstance(): any {
    if (!BaseRepository._auditServiceInstance) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { AuditService } = require('../../modules/audit/services/audit.service');
      BaseRepository._auditServiceInstance = new AuditService();
    }
    return BaseRepository._auditServiceInstance;
  }

  private isAuditable(): boolean {
    return !AUDIT_EXCLUDED_COLLECTIONS.has(this.collection.id);
  }

  /**
   * ✅ تسجيل عملية في سجل العمليات (Audit Log). النداء ده أبدًا مايرميش
   * error للفوق: فشل كتابة سجل تدقيق (مثلاً مشكلة مؤقتة في الشبكة) لازم
   * ميوقفش العملية الأساسية (حفظ/تعديل/حذف بيانات المستخدم) خالص.
   */
  private async writeAuditLog(
    action: 'create' | 'update' | 'delete',
    recordId: string,
    oldData: Record<string, any> | null,
    newData: Record<string, any> | null
  ): Promise<void> {
    if (!this.isAuditable()) return;

    try {
      const ctx = getRequestContext();
      const auditService = BaseRepository.getAuditServiceInstance();

      const changes = action === 'update' ? computeAuditChanges(oldData, newData) : undefined;
      // في حالة update، لو مفيش أي حقل اتغير فعليًا (نداء update بنفس القيم)
      // منسجلش سطر فاضي في السجل
      if (action === 'update' && changes && changes.length === 0) return;

      await auditService.log({
        userId: ctx?.userId,
        username: ctx?.username,
        module: this.collection.id,
        action,
        recordId,
        recordType: this.collection.id,
        oldData: oldData ? sanitizeForAudit(oldData) : undefined,
        newData: newData ? sanitizeForAudit(newData) : undefined,
        changes,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        sessionId: ctx?.sessionId,
        status: 'success'
      });
    } catch (error) {
      logger.error(`Failed to write audit log for ${this.collection.id}/${recordId}: ${error}`);
    }
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      const id = (data as any).id || uuidv4();
      const doc = this.collection.doc(id);
      const now = new Date().toISOString();

      const docData = {
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        version: 1
      };

      await doc.set(docData);
      logger.debug(`Document created: ${id} in ${this.collection.id}`);

      // ✅ FIX: تسجيل عملية الإضافة في سجل العمليات
      void this.writeAuditLog('create', id, null, docData);

      return docData as T;
    } catch (error) {
      logger.error(`Error creating document: ${error}`);
      throw error;
    }
  }

  async findById(id: string): Promise<T | null> {
    try {
      const doc = await this.collection.doc(id).get();
      if (!doc.exists) return null;
      const data = doc.data();
      // ✅ مستند مالوش الحقل isDeleted أصلاً (undefined) يتعامل معاه كـ "غير محذوف"
      if (data?.isDeleted) return null;
      return data as T;
    } catch (error) {
      logger.error(`Error finding document: ${error}`);
      return null;
    }
  }

  /**
   * ✅ FIX: كان الكود بيستخدم query.where('isDeleted', '==', false) داخل
   * الاستعلام نفسه في Firestore. فايرستور بيتعامل مع الفلتر ده كفلتر صارم:
   * أي مستند مالوش الحقل isDeleted أصلاً (مش موجود إطلاقًا، مش حتى false)
   * بيتستبعد تلقائيًا من نتيجة == false، حتى لو منطقيًا هو "مش محذوف".
   *
   * ده كان بيسبب رجوع مصفوفات فاضية [] لأي بيانات اتسجلت في فايرستور من غير
   * ما تعدي على create() بتاع الـ BaseRepository (استيراد بيانات قديمة،
   * سكريبت Migration، إدخال يدوي، إلخ) وبالتالي معملهاش الحقل isDeleted من
   * الأساس. بينما findById() كانت بتشتغل عادي لأنها بتتحقق من isDeleted
   * بعد الجلب (in-memory) مش كفلتر داخل الاستعلام.
   *
   * الحل: نشيل الفلتر ده من الاستعلام، ونعمل الفلترة بعد الجلب بنفس منطق
   * findById بالظبط (مستند من غير الحقل يتحسب "غير محذوف").
   */
  async findAll(options?: QueryOptions): Promise<T[]> {
    try {
      let query: D1Query = this.collection;

      if (options?.filter) {
        query = this.applyFilters(query, options.filter);
      }

      if (options?.sort) {
        Object.entries(options.sort).forEach(([field, order]) => {
          query = query.orderBy(field, order);
        });
      }

      const snapshot = await query.get();
      const results: T[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // ✅ نفس منطق findById: undefined/false => غير محذوف، true => محذوف ومستبعد
        if (!data?.isDeleted) {
          results.push(data as T);
        }
      });

      // ✅ تطبيق limit بعد فلترة isDeleted (بدل ما نطبقها كجزء من استعلام
      // Firestore) عشان الـ limit ميقصش نتائج صحيحة بسبب مستندات محذوفة
      // اتحسبت غلط ضمن العدد قبل الفلترة.
      if (options?.limit) {
        return results.slice(0, options.limit);
      }

      return results;
    } catch (error) {
      logger.error(`Error finding documents: ${error}`);
      return [];
    }
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    try {
      const doc = this.collection.doc(id);

      // ✅ FIX: نجيب نسخة السجل قبل التعديل عشان نعرف "كانت ايه وبقت ايه"
      // بالظبط في سجل العمليات. لو الجلب فشل لأي سبب، منوقفش التعديل نفسه.
      let beforeData: Record<string, any> | null = null;
      try {
        const beforeSnap = await doc.get();
        beforeData = beforeSnap.exists ? (beforeSnap.data() as any) : null;
      } catch (fetchError) {
        logger.error(`Error fetching document before update for audit: ${fetchError}`);
      }

      const now = new Date().toISOString();

      await doc.update({
        ...data,
        updatedAt: now
      });

      const updated = await doc.get();
      const updatedData = updated.data() as T;

      // ✅ FIX: تسجيل عملية التعديل في سجل العمليات (كانت ايه / بقت ايه)
      void this.writeAuditLog('update', id, beforeData, updatedData as any);

      return updatedData;
    } catch (error) {
      logger.error(`Error updating document: ${error}`);
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      // ✅ FIX: نجيب نسخة السجل قبل الحذف النهائي عشان تفضل محفوظة في سجل
      // العمليات حتى لو السجل الأصلي اتمسح خالص من قاعدة البيانات
      let beforeData: Record<string, any> | null = null;
      try {
        const beforeSnap = await this.collection.doc(id).get();
        beforeData = beforeSnap.exists ? (beforeSnap.data() as any) : null;
      } catch (fetchError) {
        logger.error(`Error fetching document before delete for audit: ${fetchError}`);
      }

      await this.collection.doc(id).delete();
      logger.debug(`Document deleted: ${id}`);

      // ✅ FIX: تسجيل عملية الحذف النهائي في سجل العمليات
      void this.writeAuditLog('delete', id, beforeData, null);

      return true;
    } catch (error) {
      logger.error(`Error deleting document: ${error}`);
      return false;
    }
  }

  async softDelete(id: string): Promise<boolean> {
    try {
      const doc = this.collection.doc(id);

      let beforeData: Record<string, any> | null = null;
      try {
        const beforeSnap = await doc.get();
        beforeData = beforeSnap.exists ? (beforeSnap.data() as any) : null;
      } catch (fetchError) {
        logger.error(`Error fetching document before soft delete for audit: ${fetchError}`);
      }

      await doc.update({
        isDeleted: true,
        deletedAt: new Date().toISOString()
      });
      logger.debug(`Document soft deleted: ${id}`);

      // ✅ FIX: تسجيل عملية الحذف (الناعم) في سجل العمليات
      void this.writeAuditLog('delete', id, beforeData, null);

      return true;
    } catch (error) {
      logger.error(`Error soft deleting document: ${error}`);
      return false;
    }
  }

  async restore(id: string): Promise<boolean> {
    try {
      const doc = this.collection.doc(id);
      await doc.update({
        isDeleted: false,
        deletedAt: null
      });
      logger.debug(`Document restored: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error restoring document: ${error}`);
      return false;
    }
  }

  /**
   * ✅ FIX: نفس مشكلة findAll بالظبط - كان فيه where('isDeleted','==',false)
   * جوه الاستعلام قبل limit(1)، فلو أول مستند مطابق للفلتر كان من غير حقل
   * isDeleted كان بيترفض بالغلط رغم إنه المفروض يترجع. دلوقتي بنجيب مجموعة
   * معقولة من النتائج المطابقة للفلتر ونفلتر isDeleted بعد الجلب زي findAll.
   */
  async findOne(filter: FilterOptions): Promise<T | null> {
    try {
      let query: D1Query = this.collection;
      query = this.applyFilters(query, filter);
      // نجيب أكتر من مستند واحد احتياطًا لوجود مستندات محذوفة ضمن أول النتائج
      query = query.limit(20);

      const snapshot = await query.get();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (!data?.isDeleted) {
          return data as T;
        }
      }
      return null;
    } catch (error) {
      logger.error(`Error finding one document: ${error}`);
      return null;
    }
  }

  /**
   * ✅ FIX: نفس المبدأ - العد بيتم بعد استبعاد المحذوف فعليًا (isDeleted === true)
   * بدل الاعتماد على فلتر Firestore الصارم == false.
   */
  async count(filter?: FilterOptions): Promise<number> {
    try {
      let query: D1Query = this.collection;
      if (filter) {
        query = this.applyFilters(query, filter);
      }
      const snapshot = await query.get();
      let total = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data?.isDeleted) {
          total += 1;
        }
      });
      return total;
    } catch (error) {
      logger.error(`Error counting documents: ${error}`);
      return 0;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const doc = await this.collection.doc(id).get();
      return doc.exists && !doc.data()?.isDeleted;
    } catch (error) {
      return false;
    }
  }

  protected applyFilters(query: D1Query, filters: FilterOptions): D1Query {
    Object.entries(filters).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        if (value.$gt !== undefined) {
          query = query.where(key, '>', value.$gt);
        } else if (value.$gte !== undefined) {
          query = query.where(key, '>=', value.$gte);
        } else if (value.$lt !== undefined) {
          query = query.where(key, '<', value.$lt);
        } else if (value.$lte !== undefined) {
          query = query.where(key, '<=', value.$lte);
        } else if (value.$in !== undefined) {
          query = query.where(key, 'in', value.$in);
        } else if (value.$ne !== undefined) {
          query = query.where(key, '!=', value.$ne);
        } else {
          query = query.where(key, '==', value);
        }
      } else {
        query = query.where(key, '==', value);
      }
    });
    return query;
  }
}

export default BaseRepository;