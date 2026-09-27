/**
 * ============================================================
 * سكريبت إضافة "قطع الغيار المستخدمة" (من تقرير Rep_CMT1_Cars) للمخازن
 * ============================================================
 *
 * الخلفية:
 * سكريبت import-cmt1-report.ts زوّد السيارات وطلبات الصيانة، لكن التقرير
 * الأصلي مكانش فيه جدول قطع غيار منفصل - المعلومة دي كانت متبعتَرة في عمود
 * "نوع الاصلاح2" (اسم القطعة/الشغلانة) + عمود "نوع الاصلاح" اللي بيوضح لو
 * دي فعلاً "شراء قطع غيار" أو "شراء خامات" (مش مجرد عمالة/شغل يدوي).
 *
 * السكريبت ده بياخد بس الصفوف اللي فعلاً "تم الاصلاح = نعم" ونوعها "شراء
 * قطع غيار/خامات"، ويعمل الآتي:
 * 1. يجمع أسماء القطع الفريدة (377 قطعة تقريبًا) ويضيف كل واحدة كصنف جديد
 *    في المخازن (collection: parts) لو مش موجودة بالفعل (بنقارن بالاسم).
 * 2. يربط كل قطعة بطلب الصيانة بتاعها (partsUsed) في نفس السجل اللي
 *    اتضاف بسكريبت import-cmt1-report.ts، بالكمية والسعر الفعلي من التقرير.
 *
 * ملحوظة مهمة: القطع دي بتتضاف كـ "صنف معروف في كتالوج المخازن" برصيد
 * حالي (currentStock) = صفر، لأنها فعليًا كانت بتتشترى وتترّكب على طول
 * وقت الصيانة (مش باقية في المخزن دلوقتي). لو حبيت تحدّث رصيد فعلي لأي
 * قطعة منها، تقدر تعمل ده يدوي بعد الاستيراد من صفحة المخازن.
 *
 * ⚠️ تحديث (بعد الانتقال من Firebase إلى Cloudflare D1):
 * بيستخدم دلوقتي طبقة التوافق (getFirestore) بتاعة D1 بدل firebase-admin.
 * مش محتاج service-account.json هنا خالص، بس محتاج .env فيه بيانات D1.
 *
 * الاستخدام (Dry Run افتراضيًا):
 *   npx ts-node scripts/import-cmt1-parts.ts            → تقرير معاينة بس
 *   npx ts-node scripts/import-cmt1-parts.ts --commit   → التنفيذ الفعلي
 *
 * ⚠️ شرط أساسي: لازم تكون شغّلت import-cmt1-report.ts --commit قبل كده،
 * عشان طلبات الصيانة تكون موجودة فعلاً في قاعدة البيانات عشان نربط بيها.
 *
 * المتطلبات: maintenance_import.json في نفس مجلد السكريبت + .env فيه بيانات D1.
 * ============================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { initializeD1, getFirestore } from '../src/core/config/d1.config';

// ============================================================
// ⚙️ إعدادات
// ============================================================
const MAINTENANCE_JSON_PATH = path.join(__dirname, 'maintenance_import.json');
const PARTS_COLLECTION = 'parts';
const MAINTENANCE_COLLECTION = 'maintenance_orders';
const IMPORT_SOURCE_TAG = 'Rep_CMT1_Cars';
const REPAIR_KINDS_AS_PARTS = ['شراء قطع غيار', 'شراء خامات'];
const PART_CODE_PREFIX = 'IMP';
const BATCH_SIZE = 400;

const isCommit = process.argv.includes('--commit');

function loadJson(filePath: string, label: string): any[] {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ملف ${label} مش موجود: ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function chunkedCommit(
  db: ReturnType<typeof getFirestore>,
  ops: Array<{ type: 'set' | 'update'; ref: any; data: any }>
) {
  let committed = 0;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const chunk = ops.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(op => {
      if (op.type === 'update') {
        batch.update(op.ref, op.data);
      } else {
        batch.set(op.ref, op.data);
      }
    });
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

  const maintenanceData = loadJson(MAINTENANCE_JSON_PATH, 'maintenance_import.json');

  // ============================================================
  // 1) استخرج صفوف "قطع الغيار المستخدمة فعليًا" بس
  // ============================================================
  const partRows = maintenanceData.filter(m => {
    const meta = m.metadata || {};
    return meta.isRepairedRaw === 'نعم'
      && REPAIR_KINDS_AS_PARTS.includes(meta.repairKind)
      && meta.repairType2 && String(meta.repairType2).trim();
  });

  console.log(`🔩 صفوف فيها قطع غيار مستخدمة فعليًا: ${partRows.length}`);

  const catalog = new Map<string, { totalPrice: number; priceCount: number }>();
  for (const row of partRows) {
    const name = String(row.metadata.repairType2).trim();
    const price = Number(row.metadata.actualValue) || Number(row.metadata.estimatedValue) || 0;
    const qty = Number(row.metadata.quantity) || 1;
    if (!catalog.has(name)) {
      catalog.set(name, { totalPrice: 0, priceCount: 0 });
    }
    const entry = catalog.get(name)!;
    if (price > 0) {
      entry.totalPrice += price / qty;
      entry.priceCount += 1;
    }
  }
  console.log(`📦 عدد أصناف قطع الغيار الفريدة: ${catalog.size}`);
  console.log('─'.repeat(60));

  // ============================================================
  // 2) اتأكد مين من القطع دي موجود بالفعل في المخازن (بالاسم)
  // ============================================================
  const partsCol = db.collection(PARTS_COLLECTION);
  const existingPartsSnap = await partsCol.get();
  const existingPartsByName = new Map<string, { id: string; code: string }>();
  existingPartsSnap.docs.forEach(d => {
    const data = d.data();
    if (!data.isDeleted && data.name) {
      existingPartsByName.set(String(data.name).trim(), { id: d.id, code: data.code });
    }
  });

  const partNameToInfo: Record<string, { id: string; code: string }> = {};
  const newPartOps: Array<{ type: 'set'; ref: any; data: any }> = [];
  let seq = 1;

  existingPartsByName.forEach(info => {
    const match = /^IMP-(\d+)$/.exec(info.code || '');
    if (match) seq = Math.max(seq, parseInt(match[1], 10) + 1);
  });

  for (const [name, stats] of catalog.entries()) {
    if (existingPartsByName.has(name)) {
      partNameToInfo[name] = existingPartsByName.get(name)!;
      continue;
    }
    const id = uuidv4();
    const code = `${PART_CODE_PREFIX}-${String(seq).padStart(6, '0')}`;
    seq++;
    const now = new Date().toISOString();
    const avgPrice = stats.priceCount > 0 ? Math.round((stats.totalPrice / stats.priceCount) * 100) / 100 : 0;

    const docData = {
      id,
      code,
      name,
      nameAr: name,
      unit: 'piece',
      unitPrice: avgPrice,
      lastPurchasePrice: avgPrice,
      averagePrice: avgPrice,
      currentStock: 0,
      minimumStock: 0,
      isConsumable: true,
      isActive: true,
      description: 'تم إنشاؤه تلقائيًا من استيراد تقرير Rep_CMT1_Cars',
      metadata: { importSource: IMPORT_SOURCE_TAG },
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      version: 1,
    };
    partNameToInfo[name] = { id, code };
    newPartOps.push({ type: 'set', ref: partsCol.doc(id), data: docData });
  }

  console.log(`🆕 أصناف قطع غيار جديدة هتتضاف للمخزن: ${newPartOps.length}`);
  console.log(`⏭️  أصناف موجودة بالفعل وهتترتبط بس (من غير تكرار): ${catalog.size - newPartOps.length}`);
  console.log('─'.repeat(60));

  // ============================================================
  // 3) هات كل طلبات الصيانة اللي اتستوردت من نفس المصدر عشان نربط partsUsed
  // ============================================================
  console.log('🔎 جاري جلب طلبات الصيانة المستوردة عشان الربط...');
  const importedOrdersSnap = await db.collection(MAINTENANCE_COLLECTION)
    .where('metadata.importSource', '==', IMPORT_SOURCE_TAG)
    .get();

  const orderBySourceRow = new Map<number, { ref: any; data: any }>();
  importedOrdersSnap.docs.forEach(d => {
    const data = d.data();
    if (data.isDeleted) return;
    const sourceRow = data.metadata && data.metadata.sourceRow;
    if (sourceRow !== undefined && sourceRow !== null) {
      orderBySourceRow.set(sourceRow, { ref: d.ref, data });
    }
  });
  console.log(`   لقينا ${orderBySourceRow.size} طلب صيانة مستورد في قاعدة البيانات.`);
  console.log('─'.repeat(60));

  // ============================================================
  // 4) اربط partsUsed بكل طلب (مع تفادي التكرار لو اتشغل قبل كده)
  // ============================================================
  const updateOps: Array<{ type: 'update'; ref: any; data: any }> = [];
  let alreadyLinked = 0;
  let noMatchingOrder = 0;

  for (const row of partRows) {
    const sourceRow = row.metadata.sourceRow;
    const match = orderBySourceRow.get(sourceRow);
    if (!match) {
      noMatchingOrder++;
      continue;
    }

    const existingPartsUsed = match.data.partsUsed || [];
    const alreadyHasImportedPart = existingPartsUsed.some((p: any) => p && p.importSource === IMPORT_SOURCE_TAG);
    if (alreadyHasImportedPart) {
      alreadyLinked++;
      continue;
    }

    const name = String(row.metadata.repairType2).trim();
    const info = partNameToInfo[name];
    const qty = Number(row.metadata.quantity) || 1;
    const totalPrice = Number(row.metadata.actualValue) || Number(row.metadata.estimatedValue) || 0;
    const unitPrice = qty > 0 ? Math.round((totalPrice / qty) * 100) / 100 : totalPrice;

    const newPartUsed = {
      partId: info.id,
      partName: name,
      name: name,
      partCode: info.code,
      quantity: qty,
      unit: 'piece',
      price: unitPrice,
      totalPrice: totalPrice,
      importSource: IMPORT_SOURCE_TAG,
    };

    updateOps.push({
      type: 'update',
      ref: match.ref,
      data: { partsUsed: [...existingPartsUsed, newPartUsed], updatedAt: new Date().toISOString() },
    });
  }

  console.log(`🔗 طلبات صيانة هيتضاف لها قطعة غيار مستخدمة: ${updateOps.length}`);
  if (alreadyLinked > 0) console.log(`⏭️  طلبات كانت مربوطة بالفعل (اتخطيت): ${alreadyLinked}`);
  if (noMatchingOrder > 0) console.log(`⚠️  طلبات مفيهاش سجل مطابق في قاعدة البيانات (لازم تشغل import-cmt1-report.ts --commit الأول): ${noMatchingOrder}`);
  console.log('─'.repeat(60));

  if (!isCommit) {
    console.log('\nℹ️  ده كان تقرير معاينة بس (Dry Run) - مفيش أي حاجة اتكتبت في قاعدة البيانات.');
    console.log('   لو الأرقام دي شكلها صح، شغّل السكريبت تاني بـ --commit:');
    console.log('   npx ts-node scripts/import-cmt1-parts.ts --commit');
    process.exit(0);
  }

  console.log('\n💾 جاري إضافة أصناف قطع الغيار الجديدة للمخزن...');
  await chunkedCommit(db, newPartOps);
  console.log('✅ تم.');

  console.log('\n💾 جاري ربط قطع الغيار المستخدمة بطلبات الصيانة...');
  await chunkedCommit(db, updateOps);
  console.log('✅ تم.');

  console.log('\n🎉 تم الاستيراد بنجاح.');
  console.log(`   أصناف قطع غيار جديدة: ${newPartOps.length}`);
  console.log(`   طلبات صيانة اتربطت بقطع غيار: ${updateOps.length}`);
}

main().catch(err => {
  console.error('❌ حصل خطأ أثناء الاستيراد:', err);
  process.exit(1);
});