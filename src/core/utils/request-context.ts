import { AsyncLocalStorage } from 'async_hooks';

/**
 * ============================================================
 * ✅ سياق الطلب (Request Context)
 * ============================================================
 * المشكلة اللي بيحلها الملف ده: سجل العمليات (Audit Log) كان دايمًا
 * بيسجل "غير معروف" لأن مفيش أي طريقة عامة لمعرفة "مين" بيعمل العملية
 * جوه الـ Repository (اللي هو المكان المركزي اللي كل الموديولات بتعدي
 * عليه عشان تعمل create/update/delete).
 *
 * تمرير req.user يدويًا لكل service/repository في النظام كان هيحتاج
 * تعديل عشرات الملفات. بدل كده، بنستخدم AsyncLocalStorage: middleware
 * واحدة بتحط بيانات المستخدم الحالي في "context" مربوط بالـ async chain
 * بتاعة الطلب نفسه، وأي كود بعد كده (في نفس الطلب) يقدر يقراها من غير
 * ما يتمررله حاجة صراحةً.
 */
export interface RequestAuditContext {
  userId?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

const storage = new AsyncLocalStorage<RequestAuditContext>();

export const runWithRequestContext = <T>(context: RequestAuditContext, fn: () => T): T => {
  return storage.run(context, fn);
};

export const getRequestContext = (): RequestAuditContext | undefined => {
  return storage.getStore();
};
