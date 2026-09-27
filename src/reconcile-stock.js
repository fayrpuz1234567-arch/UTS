/**
 * ============================================================
 * سكريبت تصحيح أرصدة المخزون (Stock Reconciliation)
 * ============================================================
 *
 * ليه محتاجين السكريبت ده؟
 * كان فيه باگ في inventory.service.ts -> createTransaction بيخلي حركات
 * "issue" (سحب قطعة للصيانة) تزود المخزون بدل ما تنقصه. يعني currentStock
 * المخزّن في جدول القطع (parts) دلوقتي ممكن يكون غلط.
 *
 * السكريبت ده بيعمل الآتي:
 * 1. يقرأ كل حركات المخزون (inventorytransactions) الحقيقية.
 * 2. يعيد حساب الرصيد الصح لكل قطعة بناءً على نوع كل حركة (استلام = زيادة،
 *    سحب = نقصان... إلخ) - بغض النظر عن أي رصيد مسجل غلط قبل كده.
 * 3. يقارن الرصيد المحسوب بالرصيد المسجل حالياً في القطعة، ويطبع تقرير بالفرق.
 * 4. من غير --commit: التقرير بس (مفيش أي تعديل على الداتابيز - آمن 100%).
 *    مع --commit: يحدّث currentStock فعلياً + يسجل نسخة احتياطية (JSON)
 *    بالقيم القديمة قبل التعديل عشان لو احتجت ترجع فيها.
 *
 * الاستخدام:
 *   node reconcile-stock.js                → تقرير بس (Dry Run)
 *   node reconcile-stock.js --commit        → تطبيق التصحيح فعلياً
 *
 * المتطلبات:
 *   - Node.js
 *   - npm install mongodb   (لو مش متثبت أصلاً)
 *   - environment variable باسم MONGODB_URI بيشاور على نفس قاعدة البيانات
 *     (لو الاسم عندك مختلف، غيّره في MONGODB_URI_ENV_NAME تحت)
 * ============================================================
 */

const { MongoClient, ObjectId } = require('mongodb');

// ============================================================
// ⚙️ إعدادات - عدّل هنا لو أسماء الـ collections مختلفة عندك
// ============================================================
const MONGODB_URI_ENV_NAME = 'MONGODB_URI';
const PARTS_COLLECTION = 'parts';
const TRANSACTIONS_COLLECTION = 'inventorytransactions';
const BACKUP_FILE_PREFIX = 'stock-reconcile-backup';

// أنواع الحركات اللي بتزود المخزون
const INCREASE_TYPES = ['receiving', 'transfer_in', 'adjustment_in', 'return'];
// أنواع الحركات اللي بتقلل المخزون
const DECREASE_TYPES = ['issue', 'transfer_out', 'adjustment_out', 'damaged', 'lost'];
// أنواع محايدة/غير معروفة (هيتم تجاهلها مع تحذير)
const NEUTRAL_OR_UNKNOWN_TYPES = ['count_adjustment'];

// الحركات دي بتتجاهل تماماً من الحساب (اتلغت أو مش فعلية)
const EXCLUDED_STATUSES = ['rejected', 'cancelled'];

// ============================================================

const isCommit = process.argv.includes('--commit');

async function main() {
  const uri = process.env[MONGODB_URI_ENV_NAME];
  if (!uri) {
    console.error(`❌ متغير البيئة ${MONGODB_URI_ENV_NAME} مش موجود. شغّل السكريبت بالشكل ده مثلاً:`);
    console.error(`   MONGODB_URI="mongodb+srv://..." node reconcile-stock.js`);
    process.exit(1);
  }

  console.log(isCommit
    ? '⚠️  وضع التنفيذ الفعلي (COMMIT) - هيتم تعديل الداتابيز'
    : '🔍 وضع المعاينة فقط (DRY RUN) - مفيش أي تعديل هيحصل');
  console.log('─'.repeat(60));

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    const partsCol = db.collection(PARTS_COLLECTION);
    const txCol = db.collection(TRANSACTIONS_COLLECTION);

    // 1) هات كل القطع الغير محذوفة
    const parts = await partsCol.find({ isDeleted: { $ne: true } }).toArray();
    console.log(`📦 عدد القطع: ${parts.length}`);

    // 2) هات كل الحركات الفعلية (مش مرفوضة ومش ملغاة)
    const transactions = await txCol.find({
      status: { $nin: EXCLUDED_STATUSES }
    }).toArray();
    console.log(`📜 عدد الحركات المعتبرة في الحساب: ${transactions.length}`);
    console.log('─'.repeat(60));

    // 3) اجمع الحركات حسب partId
    const deltaByPart = {}; // partId(string) -> delta
    const unknownTypesSeen = new Set();

    for (const tx of transactions) {
      const partIdStr = tx.partId ? tx.partId.toString() : null;
      if (!partIdStr) continue;

      const qty = Number(tx.quantity) || 0;
      let delta = 0;

      if (INCREASE_TYPES.includes(tx.transactionType)) {
        delta = qty;
      } else if (DECREASE_TYPES.includes(tx.transactionType)) {
        delta = -qty;
      } else if (NEUTRAL_OR_UNKNOWN_TYPES.includes(tx.transactionType)) {
        // النوع ده مش واضح اتجاهه - هنتجاهله بس هنسجله كتحذير
        unknownTypesSeen.add(tx.transactionType);
        continue;
      } else {
        unknownTypesSeen.add(tx.transactionType || '(بدون نوع)');
        continue;
      }

      deltaByPart[partIdStr] = (deltaByPart[partIdStr] || 0) + delta;
    }

    if (unknownTypesSeen.size > 0) {
      console.log(`⚠️  فيه أنواع حركات اتجاهلت لأنها مش معروفة أو محايدة: ${[...unknownTypesSeen].join(', ')}`);
      console.log('   (راجعها يدوي لو محتاجة تتحسب)');
      console.log('─'.repeat(60));
    }

    // 4) قارن كل قطعة بالرصيد المحسوب
    const report = [];
    for (const part of parts) {
      const partIdStr = part._id.toString();
      const recomputedStock = deltaByPart[partIdStr] || 0;
      const currentStock = Number(part.currentStock) || 0;
      const diff = recomputedStock - currentStock;

      if (diff !== 0) {
        report.push({
          id: partIdStr,
          code: part.code || '-',
          name: part.name || '-',
          oldStock: currentStock,
          newStock: recomputedStock,
          diff
        });
      }
    }

    // 5) اطبع التقرير
    if (report.length === 0) {
      console.log('✅ مفيش أي فرق - كل الأرصدة مطابقة لسجل الحركات. مفيش داعي لأي تعديل.');
    } else {
      console.log(`🔎 لقينا ${report.length} قطعة برصيد مختلف عن سجل الحركات:\n`);
      console.log(
        'الكود'.padEnd(15) +
        'الاسم'.padEnd(30) +
        'الحالي'.padEnd(10) +
        'الصح'.padEnd(10) +
        'الفرق'
      );
      console.log('─'.repeat(75));
      for (const r of report) {
        console.log(
          String(r.code).padEnd(15) +
          String(r.name).slice(0, 28).padEnd(30) +
          String(r.oldStock).padEnd(10) +
          String(r.newStock).padEnd(10) +
          (r.diff > 0 ? `+${r.diff}` : `${r.diff}`)
        );
      }
      console.log('─'.repeat(75));
      console.log(`\nإجمالي القطع المتأثرة: ${report.length}`);
    }

    // 6) لو --commit اتبعت، طبّق التعديل فعلياً
    if (isCommit && report.length > 0) {
      console.log('\n💾 جاري حفظ نسخة احتياطية بالقيم القديمة...');
      const fs = require('fs');
      const backupFileName = `${BACKUP_FILE_PREFIX}-${Date.now()}.json`;
      fs.writeFileSync(backupFileName, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`✅ اتحفظت نسخة احتياطية في: ${backupFileName}`);
      console.log('   (لو احتجت ترجع للقيم القديمة، الملف ده فيه oldStock لكل قطعة)');

      console.log('\n🔧 جاري تطبيق التصحيح...');
      let updatedCount = 0;
      for (const r of report) {
        await partsCol.updateOne(
          { _id: new ObjectId(r.id) },
          { $set: { currentStock: r.newStock, updatedAt: new Date().toISOString() } }
        );
        updatedCount++;
      }
      console.log(`✅ تم تحديث ${updatedCount} قطعة بنجاح.`);
    } else if (!isCommit && report.length > 0) {
      console.log('\nℹ️  ده كان تقرير معاينة بس. لو النتائج شكلها منطقي، شغّل السكريبت تاني بـ --commit عشان تطبّق التصحيح فعلياً:');
      console.log(`   MONGODB_URI="..." node reconcile-stock.js --commit`);
    }

  } catch (err) {
    console.error('❌ حصل خطأ:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();