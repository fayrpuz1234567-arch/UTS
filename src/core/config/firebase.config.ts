import admin from 'firebase-admin';
import { logger } from '../utils/logger';

let firebaseApp: admin.app.App;

export const initializeFirebase = () => {
  try {
    if (!firebaseApp) {
      // Load service account from file
      const serviceAccount = require('../../../service-account.json');
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
      });

      // ============================================================
      // ✅ FIX: سبب رئيسي في إن "سجل العمليات" (Audit Log) كان بيفضل
      // فاضي دايمًا مهما اتعمل تعديل في النظام.
      //
      // فايرستور بشكل افتراضي (ignoreUndefinedProperties = false) بيرفض
      // تمامًا أي عملية .set() / .update() فيها حقل قيمته undefined،
      // وبيرمي Exception زي:
      //   "Cannot use \"undefined\" as a Firestore value (found in field ...)"
      //
      // والـ middleware العام لتسجيل العمليات (audit) في index.ts بيبني
      // كائن البيانات وفيه حقول اختيارية بتبقى undefined في الحالة العادية
      // (الناجحة)، أشهرها errorMessage:
      //   errorMessage: status !== 'success' ? `HTTP ${res.statusCode}` : undefined
      // يعني في أي عملية ناجحة (وهي الغالبية العظمى من التعديلات) كان
      // بيتبعت undefined في errorMessage، فـ auditRepo.create() كان بيرمي
      // خطأ جوه BaseRepository.create()، والخطأ ده كان بيتلقط بصمت في
      // الـ middleware (.catch(err => logger.error(...))) من غير ما يوقف
      // الطلب الأصلي أو يظهر أي حاجة للمستخدم - فكانت كل عمليات الحفظ في
      // audit_logs بتفشل من غير ما حد يلاحظ، وصفحة "سجل العمليات" تفضل فاضية
      // دايمًا.
      //
      // نفس المشكلة ممكن تكون بتأثر على أي موديول تاني بيبعت حقل اختياري
      // بقيمة undefined عند الإنشاء/التعديل (مش بس الـ audit).
      //
      // الحل: تفعيل ignoreUndefinedProperties على مستوى Firestore كله،
      // فأي حقل قيمته undefined يتجاهل تلقائيًا (زي ما بيحصل مع null أو
      // ببساطة بيتشال من المستند) بدل ما يوقف كل عملية الحفظ بالغلط.
      // لازم تتنادى مرة واحدة بس وقبل أي عملية على Firestore، فمكانها
      // هنا مباشرة بعد initializeApp هو الأنسب.
      // ============================================================
      firebaseApp.firestore().settings({ ignoreUndefinedProperties: true });

      logger.info('✅ Firebase initialized successfully');
    }
    return firebaseApp;
  } catch (error) {
    logger.error('❌ Firebase initialization failed:', error);
    throw error;
  }
};

export const getFirestore = () => {
  if (!firebaseApp) initializeFirebase();
  return admin.firestore();
};

export const getAuth = () => {
  if (!firebaseApp) initializeFirebase();
  return admin.auth();
};

export const getStorage = () => {
  if (!firebaseApp) initializeFirebase();
  return admin.storage();
};

export const getMessaging = () => {
  if (!firebaseApp) initializeFirebase();
  return admin.messaging();
};

export default { initializeFirebase, getFirestore, getAuth, getStorage, getMessaging };