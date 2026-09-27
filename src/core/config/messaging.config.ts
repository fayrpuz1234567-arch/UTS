import admin from 'firebase-admin';
import { logger } from '../utils/logger';

// ============================================================
// ✅ ملحوظة مهمة: بعد نقل قاعدة البيانات بالكامل من Firestore إلى
// Cloudflare D1 (شوف d1.config.ts)، الملف ده بقى مستخدم لغرض واحد بس:
// إرسال الإشعارات (Push Notifications) عن طريق Firebase Cloud Messaging
// (FCM)، لأن ده خدمة منفصلة تمامًا عن قاعدة البيانات ومفيش لها بديل في
// Cloudflare D1 (D1 قاعدة بيانات بس، مش خدمة إشعارات).
//
// يعني: فايرستور (قاعدة البيانات) اتشال خالص من المشروع، لكن Firebase
// Admin SDK لسه موجود بغرض واحد ضيق ومحدد هو FCM فقط. لو حابب تشيل
// خدمة الإشعارات دي كمان أو تستبدلها بخدمة تانية (زي OneSignal مثلاً)،
// قولّي وهعمل التعديل ده منفصل.
// ============================================================

let messagingApp: admin.app.App;

const initializeMessaging = () => {
  if (!messagingApp) {
    // نفس ملف service-account.json المستخدم قبل كده (بيانات مشروع Firebase
    // اللي فيه إعداد FCM)
    const serviceAccount = require('../../../service-account.json');

    messagingApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    logger.info('✅ Firebase Messaging (FCM) initialized successfully');
  }
  return messagingApp;
};

export const getMessaging = () => {
  if (!messagingApp) initializeMessaging();
  return admin.messaging();
};

export default { getMessaging };
