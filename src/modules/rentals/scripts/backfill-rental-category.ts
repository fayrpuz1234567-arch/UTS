/**
 * ============================================================
 * ✅ سكريبت تعبئة حقل rentalCategory للإيجارات القديمة بأثر رجعي
 * ============================================================
 *
 * المشكلة:
 *   الإيجارات القديمة مفيهاش حقل rentalCategory (داخلي/خارجي)،
 *   وتقرير السائقين كان بيحاول يخمّنه من السعر (>= 300 = خارجي)،
 *   وده غلط لو الإيجار القديم كان بسعر مختلف عن 200/300.
 *
 * الحل الصحيح والآمن:
 *   - السكريبت ده مش بيخمّن. بيصنّف بس الإيجارات اللي سعرها
 *     يطابق **بالظبط** أحد السعرين المعروفين (200 = داخلي، 300 = خارجي).
 *   - أي إيجار سعره مختلف أو ناقص بيتسجّل في تقرير "يحتاج مراجعة"
 *     ومبيتلمسش خالص — القرار فيه ليك أنت.
 *   - وضع "تجربة" (dry-run) هو الافتراضي: بيوريك تقرير بس من غير
 *     ما يعدّل أي حاجة في القاعدة. لازم تمرّر --apply عشان يكتب فعلياً.
 *   - أي إيجار عنده rentalCategory بالفعل — مبيتلمسش، أياً كان سعره.
 *
 * الاستخدام:
 *   ts-node modules/rentals/scripts/backfill-rental-category.ts            (تجربة فقط)
 *   ts-node modules/rentals/scripts/backfill-rental-category.ts --apply    (تنفيذ فعلي)
 *
 * بعد التشغيل بيطلعلك ملف JSON فيه كل الإيجارات اللي محتاجة مراجعة يدوية
 * (رقم أمر التشغيل، السعر، السائق) عشان تحددلهم النوع بنفسك من الشاشة
 * أو تمررهم لتعديل يدوي في القاعدة.
 * ============================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { RentalRepository } from '../repositories/rental.repository';

const KNOWN_RATES: Record<number, 'internal' | 'external'> = {
  200: 'internal',
  300: 'external',
};

interface ReviewEntry {
  id: string;
  orderNumber?: string;
  rentalNumber?: string;
  driverName?: string;
  unitPrice?: number;
  rentalValue?: number;
  startDate?: string;
  reason: string;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const repo = new RentalRepository();

  console.log('============================================================');
  console.log(apply ? '🔴 وضع التنفيذ الفعلي (--apply)' : '🟡 وضع التجربة فقط (dry-run) — مفيش تعديل هيحصل');
  console.log('============================================================\n');

  const allRentals = (await repo.findAll({ filter: { isDeleted: { $ne: true } } })) as any[];
  console.log(`إجمالي الإيجارات: ${allRentals.length}`);

  const alreadySet = allRentals.filter((r) => r.rentalCategory === 'internal' || r.rentalCategory === 'external');
  const missing = allRentals.filter((r) => r.rentalCategory !== 'internal' && r.rentalCategory !== 'external');

  console.log(`عندها rentalCategory بالفعل (هتتجاهل): ${alreadySet.length}`);
  console.log(`محتاجة تعبئة: ${missing.length}\n`);

  let assignedInternal = 0;
  let assignedExternal = 0;
  const needsReview: ReviewEntry[] = [];

  for (const rental of missing) {
    const price = Number(rental.unitPrice ?? rental.rentalValue ?? NaN);
    const matched = KNOWN_RATES[price];

    if (matched) {
      if (apply) {
        await repo.update(rental.id, {
          rentalCategory: matched,
          updatedAt: new Date().toISOString(),
        } as any);
      }
      if (matched === 'internal') assignedInternal++;
      else assignedExternal++;
    } else {
      needsReview.push({
        id: rental.id,
        orderNumber: rental.orderNumber,
        rentalNumber: rental.rentalNumber,
        driverName: rental.driverName,
        unitPrice: rental.unitPrice,
        rentalValue: rental.rentalValue,
        startDate: rental.startDate,
        reason: isNaN(price)
          ? 'مفيش سعر مسجّل على الإطلاق'
          : `السعر (${price}) مش مطابق لأي سعر معروف (200 أو 300)`,
      });
    }
  }

  console.log('============================================================');
  console.log('النتيجة:');
  console.log(`  ✅ اتصنّفت "داخلي" (سعر 200 بالظبط): ${assignedInternal}`);
  console.log(`  ✅ اتصنّفت "خارجي" (سعر 300 بالظبط): ${assignedExternal}`);
  console.log(`  ⚠️  محتاجة مراجعة يدوية: ${needsReview.length}`);
  console.log('============================================================\n');

  if (needsReview.length > 0) {
    const outDir = path.join(process.cwd(), 'uploads', 'reports');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `rentals-needing-category-review-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(needsReview, null, 2), 'utf-8');
    console.log(`📄 قائمة المراجعة اتكتبت في: ${outPath}`);
    console.log('   (الإيجارات دي هتفضل بدون تصنيف في تقرير السائقين لحد ما تحددها يدوياً)\n');
  }

  if (!apply && (assignedInternal > 0 || assignedExternal > 0)) {
    console.log('ℹ️  ده كان تجربة بس. لتنفيذ التعديل فعلياً، شغّل السكريبت تاني بإضافة --apply\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ خطأ أثناء تشغيل السكريبت:', err);
    process.exit(1);
  });
