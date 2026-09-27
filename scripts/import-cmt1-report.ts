/**
 * ============================================================
 * سكريبت استيراد تقرير Rep_CMT1_Cars (سيارات + طلبات صيانة)
 * ============================================================
 *
 * الفكرة:
 * ملف الإكسيل اللي بعته فيه لكل سيارة "بلوك" من الصفوف: أول صف فيه بيانات
 * السيارة كاملة + أول طلب صيانة، وباقي صفوف البلوك كل صف منها طلب صيانة
 * تاني لنفس السيارة (خلايا بيانات السيارة فاضية فيهم لأنها Merged Cells في
 * الإكسيل الأصلي). السكريبت ده بياخد ناتج تحليل الملف (JSON جاهز) ويحطه في
 * المكان الصح بالظبط: كل سيارة في collection السيارات، وكل طلب صيانة في
 * collection طلبات الصيانة، مربوط تلقائيًا بالسيارة بتاعته (vehicleId).
 *
 * ⚠️ تحديث (بعد الانتقال من Firebase إلى Cloudflare D1):
 * السكريبت ده بقى بيكتب في D1 بدل Firestore، عن طريق نفس طبقة التوافق
 * (getFirestore) المستخدمة في باقي المشروع (src/core/config/d1.config.ts)
 * — الشكل البرمجي (collection/doc/where/batch) فضل زي ما هو تمامًا،
 * الفرق بس في مصدر البيانات. مبقاش محتاج service-account.json ولا
 * firebase-admin هنا خالص؛ بدل منه محتاج CLOUDFLARE_ACCOUNT_ID و
 * CLOUDFLARE_D1_DATABASE_ID و CLOUDFLARE_API_TOKEN في ملف .env (نفس القيم
 * اللي جربتها في test-d1-connection.js).
 *
 * آمان الاستيراد (Dry Run افتراضيًا):
 *   npx ts-node scripts/import-cmt1-report.ts            → تقرير معاينة بس - مفيش أي كتابة فعلية
 *   npx ts-node scripts/import-cmt1-report.ts --commit   → التنفيذ الفعلي والكتابة في قاعدة البيانات
 *
 * الاستيراد آمن لو اتشغّل أكتر من مرة (Idempotent):
 * - أي سيارة رقم لوحتها موجود فعلاً في قاعدة البيانات هيتم تخطيها (مش هتتكرر)،
 *   وهيستخدم نفس السيارة الموجودة عشان يربط بيها طلبات الصيانة.
 * - أي طلب صيانة اتسجل قبل كده من نفس الاستيراد (بنعرفه من رقم الصف الأصلي
 *   sourceRow المحفوظ في metadata) هيتم تخطيه هو كمان.
 *
 * المتطلبات قبل التشغيل:
 * 1. الملفين دول لازم يكونوا في نفس مجلد السكريبت ده:
 *    - vehicles_import.json
 *    - maintenance_import.json
 * 2. ملف .env فيه بيانات D1 الثلاثة (Account ID / Database ID / API Token).
 * ============================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { initializeD1, getFirestore } from '../src/core/config/d1.config';

// ============================================================
// ⚙️ إعدادات - عدّل هنا لو أسماء الـ collections أو مسار الملفات مختلف
// ============================================================
const VEHICLES_JSON_PATH = path.join(__dirname, 'vehicles_import.json');
const MAINTENANCE_JSON_PATH = path.join(__dirname, 'maintenance_import.json');
const VEHICLES_COLLECTION = 'vehicles';
const MAINTENANCE_COLLECTION = 'maintenance_orders';
const IMPORT_SOURCE_TAG = 'Rep_CMT1_Cars';
const BATCH_SIZE = 400;

const isCommit = process.argv.includes('--commit');

function loadJson(filePath: string, label: string): any[] {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ملف ${label} مش موجود: ${filePath}`);
    console.error('   لازم تحط ملفات vehicles_import.json و maintenance_import.json جنب السكريبت ده.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function chunkedCommit(db: ReturnType<typeof getFirestore>, ops: Array<{ ref: any; data: any }>) {
  let committed = 0;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const chunk = ops.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(op => batch.set(op.ref, op.data));
    await batch.commit();
    committed += chunk.length;
    console.log(`   ...اتكتب ${committed}/${ops.length}`);
  }
  return committed;
}

async function main() {
  console.log(isCommit
    ? '⚠️  وضع التنفيذ الفعلي (COMMIT) - هيتم الكتابة في قاعدة البيانات'
    : '🔍 وضع المعاينة فقط (DRY RUN) - مفيش أي تعديل هيحصل، ده تقرير بس');
  console.log('─'.repeat(60));

  initializeD1();
  const db = getFirestore();

  const vehiclesData = loadJson(VEHICLES_JSON_PATH, 'vehicles_import.json');
  const maintenanceData = loadJson(MAINTENANCE_JSON_PATH, 'maintenance_import.json');

  console.log(`📄 هيتم معالجة: ${vehiclesData.length} سيارة، ${maintenanceData.length} طلب صيانة`);
  console.log('─'.repeat(60));

  // ============================================================
  // 1) السيارات: تخطي أي سيارة موجودة بالفعل (نفس رقم اللوحة)
  // ============================================================
  const vehiclesCol = db.collection(VEHICLES_COLLECTION);
  const tempIdToRealId: Record<string, string> = {};
  const newVehicleOps: Array<{ ref: any; data: any }> = [];
  let skippedVehicles = 0;

  for (const v of vehiclesData) {
    const existingSnap = await vehiclesCol.where('plateNumber', '==', v.plateNumber).limit(1).get();
    const existing = existingSnap.docs.find(d => !d.data().isDeleted);

    if (existing) {
      tempIdToRealId[v.tempId] = existing.id;
      skippedVehicles++;
      continue;
    }

    const id = uuidv4();
    tempIdToRealId[v.tempId] = id;
    const now = new Date().toISOString();

    const docData = {
      id,
      internalCode: v.internalCode,
      plateNumber: v.plateNumber,
      vehicleType: v.vehicleType,
      brand: v.brand,
      model: v.model,
      manufactureYear: v.manufactureYear || new Date().getFullYear(),
      chassisNumber: v.chassisNumber,
      engineNumber: v.engineNumber,
      color: v.color,
      fuelType: v.fuelType,
      currentKM: v.currentKM || 0,
      purchaseDate: v.purchaseDate,
      assignedTo: v.assignedTo,
      licenseStatus: v.licenseStatus,
      licenseExpiry: v.licenseExpiry,
      capacity: v.capacity,
      technicalCondition: v.technicalCondition,
      status: v.status || 'available',
      isActive: true,
      notes: v.notes,
      metadata: v.metadata,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      version: 1,
    };

    newVehicleOps.push({ ref: vehiclesCol.doc(id), data: docData });
  }

  console.log(`🚗 سيارات جديدة هتتضاف: ${newVehicleOps.length}`);
  console.log(`⏭️  سيارات موجودة بالفعل وهتتخطى (نفس رقم اللوحة): ${skippedVehicles}`);
  console.log('─'.repeat(60));

  // ============================================================
  // 2) طلبات الصيانة: تخطي أي طلب استورد قبل كده من نفس المصدر (نفس sourceRow)
  // ============================================================
  const maintenanceCol = db.collection(MAINTENANCE_COLLECTION);

  console.log('🔎 جاري التحقق من الطلبات المستوردة قبل كده (ده ممكن ياخد لحظات)...');
  const existingImportedSnap = await maintenanceCol
    .where('metadata.importSource', '==', IMPORT_SOURCE_TAG)
    .get();
  const alreadyImportedRows = new Set(
    existingImportedSnap.docs
      .filter(d => !d.data().isDeleted)
      .map(d => d.data().metadata && d.data().metadata.sourceRow)
      .filter(r => r !== undefined && r !== null)
  );
  console.log(`   لقينا ${alreadyImportedRows.size} طلب اتستوردوا قبل كده من نفس الملف.`);
  console.log('─'.repeat(60));

  const newMaintenanceOps: Array<{ ref: any; data: any }> = [];
  let skippedMaintenance = 0;
  let orphanCount = 0;
  let orderCounter = 1;

  for (const m of maintenanceData) {
    const sourceRow = m.metadata && m.metadata.sourceRow;
    if (sourceRow !== undefined && alreadyImportedRows.has(sourceRow)) {
      skippedMaintenance++;
      continue;
    }

    const vehicleId = tempIdToRealId[m.vehicleTempId];
    if (!vehicleId) {
      orphanCount++;
      console.warn(`   ⚠️  متجاهلين طلب صيانة (صف ${sourceRow}) - مفيش سيارة مرتبطة بيه (لوحة: ${m.vehiclePlateNumber})`);
      continue;
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const orderNumber = m.orderNumber || `IMPORT-${String(orderCounter).padStart(6, '0')}`;
    orderCounter++;

    const docData = {
      id,
      orderNumber,
      vehicleId,
      problemDescription: m.problemDescription,
      startDate: m.startDate || now.split('T')[0],
      endDate: m.endDate,
      startKM: m.startKM || 0,
      laborCost: m.laborCost || 0,
      partsCost: m.partsCost || 0,
      totalCost: m.totalCost || 0,
      priority: m.priority || 'medium',
      status: m.status || 'pending_parts',
      isUnderWarranty: false,
      approvalStatus: 'approved',
      notes: m.notes,
      metadata: m.metadata,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      version: 1,
    };

    newMaintenanceOps.push({ ref: maintenanceCol.doc(id), data: docData });
  }

  console.log(`🛠️  طلبات صيانة جديدة هتتضاف: ${newMaintenanceOps.length}`);
  console.log(`⏭️  طلبات اتخطيت (اتستوردت قبل كده): ${skippedMaintenance}`);
  if (orphanCount > 0) {
    console.log(`⚠️  طلبات اتجاهلت لعدم وجود سيارة مرتبطة: ${orphanCount}`);
  }
  console.log('─'.repeat(60));

  if (!isCommit) {
    console.log('\nℹ️  ده كان تقرير معاينة بس (Dry Run) - مفيش أي حاجة اتكتبت في قاعدة البيانات.');
    console.log('   لو الأرقام دي شكلها صح، شغّل السكريبت تاني بـ --commit عشان يتنفذ فعليًا:');
    console.log('   npx ts-node scripts/import-cmt1-report.ts --commit');
    process.exit(0);
  }

  console.log('\n💾 جاري كتابة السيارات...');
  await chunkedCommit(db, newVehicleOps);
  console.log('✅ تم حفظ السيارات.');

  console.log('\n💾 جاري كتابة طلبات الصيانة...');
  await chunkedCommit(db, newMaintenanceOps);
  console.log('✅ تم حفظ طلبات الصيانة.');

  console.log('\n🎉 تم الاستيراد بنجاح.');
  console.log(`   إجمالي السيارات المضافة: ${newVehicleOps.length}`);
  console.log(`   إجمالي طلبات الصيانة المضافة: ${newMaintenanceOps.length}`);
}

main().catch(err => {
  console.error('❌ حصل خطأ أثناء الاستيراد:', err);
  process.exit(1);
});