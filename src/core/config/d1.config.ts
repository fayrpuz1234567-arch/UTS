import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

// ✅ حماية إضافية: لو أي سكريبت أو موديول عمل import للملف ده مباشرة من غير
// ما يعدي على index.ts (اللي بينده dotenv.config() الأول)، بنحمّل متغيرات
// .env هنا كمان بأمان. dotenv.config() آمنة تتنادى أكتر من مرة (مالهاش أي
// تأثير جانبي لو المتغيرات كانت اتحمّلت قبل كده أصلاً).
import 'dotenv/config';

// ============================================================
// ✅ بديل Firestore: طبقة اتصال بقاعدة بيانات Cloudflare D1
// ============================================================
// D1 مش سيرفر بنعمل له اتصال TCP زي MongoDB/Postgres — هي قاعدة SQLite
// شغّالة جوه Cloudflare، وبنكلمها عن طريق REST API (HTTP) باستخدام
// Account ID + Database ID + API Token. ده معناه إن الباك إند بتاعنا
// (شغّال Local على الجهاز أو على أي سيرفر) بيبعت أوامر SQL كـ HTTP request
// عادي، بدل ما يعمل اتصال مباشر بالقاعدة.
//
// عشان نتفادى تعديل كل موديول من الـ 20+ موديول (كل واحد فيهم بيستخدم
// this.collection.doc(id).get()/.set()/.update()/... بأسلوب Firestore)،
// بنعمل هنا طبقة "توافق" (Compatibility Layer) بتوفّر نفس الشكل البرمجي
// (collection → doc → get/set/update/delete، وكمان where/orderBy/limit)
// لكن من تحت بتتكلم مع D1 عن طريق SQL بدل Firestore SDK.
//
// كل "كولكشن" في Firestore بيتحول هنا لجدول (Table) في D1 بعمودين بس:
//   id   TEXT PRIMARY KEY   -- نفس الـ id اللي كان مستخدم في فايرستور
//   data TEXT               -- المستند كامل مخزّن كـ JSON (زي ما كان في فايرستور تمامًا)
// الطريقة دي بتحافظ على نفس المرونة اللي كانت موجودة في فايرستور (مفيش
// schema ثابت لازم نصممه لكل موديول دلوقتي)، وبتخلي كل الموديولات
// (repositories/services/controllers) تشتغل من غير أي تعديل تقريبًا،
// لأنها كلها بتعتمد على BaseRepository أو على شكل الاستدعاءات دي.
// ============================================================

interface D1EnvConfig {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

const getEnvConfig = (): D1EnvConfig => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      'Missing Cloudflare D1 credentials. تأكد إن ملف .env فيه ' +
        'CLOUDFLARE_ACCOUNT_ID و CLOUDFLARE_D1_DATABASE_ID و CLOUDFLARE_API_TOKEN.'
    );
  }

  return { accountId, databaseId, apiToken };
};

let cachedConfig: D1EnvConfig | null = null;
const getConfig = (): D1EnvConfig => {
  if (!cachedConfig) cachedConfig = getEnvConfig();
  return cachedConfig;
};

// ✅ FIX: كل قراءة/كتابة هنا في الحقيقة HTTP request لسيرفرات Cloudflare
// عبر الإنترنت (مش اتصال مباشر بقاعدة بيانات جوه نفس الشبكة). من غير أي
// timeout، لو الشبكة أو Cloudflare اتأخروا لحظة (D1 cold start، أو ضغط
// مؤقت) كان الـ request يفضل معلّق من غير حد أقصى، وده اللي بيظهر للمستخدم
// كـ"الخادم لا يستجيب". ومن غير إعادة محاولة، أي عطل عابر (Timeout/انقطاع
// شبكة لحظي/429 Rate Limit من Cloudflare) كان بيتحول لخطأ نهائي فورًا —
// وده أصل مشكلة "الاسم والباسورد صح وبيقول غلط" و"الحساب مبقاش موجود"
// (راجع findById/findOne في base.repository.ts: بيبلعوا أي Error هنا
// ويرجعوا null، فالتفريق بين "مش موجود فعلاً" و"القراءة فشلت مؤقتًا" كان
// بيضيع من هنا بالظبط).
//
// الحل: timeout واضح (بدل التعليق اللانهائي) + إعادة محاولة محدودة
// (Timeout / خطأ شبكة / 429 / أخطاء 5xx بس — مش أخطاء SQL أو صلاحيات، دي
// مفيش فايدة من إعادة محاولتها) بتأخير متزايد بسيط بين كل محاولة.
const D1_TIMEOUT_MS = 10000;
const D1_MAX_RETRIES = 2;
const D1_RETRY_BASE_DELAY_MS = 300;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableHttpStatus = (status: number): boolean => status === 429 || (status >= 500 && status <= 599);

const runD1Query = async (sql: string, params: any[] = []): Promise<any[]> => {
  const { accountId, databaseId, apiToken } = getConfig();
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  let lastError: any = null;

  for (let attempt = 0; attempt <= D1_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), D1_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql, params }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok && isRetryableHttpStatus(res.status) && attempt < D1_MAX_RETRIES) {
        lastError = new Error(`D1 query failed with HTTP ${res.status}`);
        logger.warn(`D1 query attempt ${attempt + 1} got HTTP ${res.status}, retrying... | SQL: ${sql}`);
        await sleep(D1_RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      const json: any = await res.json();

      if (!res.ok || !json.success) {
        const errMsg = json?.errors?.map((e: any) => e.message).join(', ') || res.statusText;
        logger.error(`D1 query failed: ${errMsg} | SQL: ${sql}`);
        throw new Error(`D1 query failed: ${errMsg}`);
      }

      // Cloudflare بترجع النتيجة كمصفوفة (batch)، كل عنصر فيه results
      return json.result?.[0]?.results ?? [];
    } catch (error: any) {
      clearTimeout(timer);

      if (error?.name === 'AbortError') {
        lastError = new Error(`D1 query timed out after ${D1_TIMEOUT_MS}ms | SQL: ${sql}`);
      } else if (error instanceof TypeError) {
        // fetch() بيرمي TypeError لأي فشل شبكة (DNS/انقطاع اتصال/...)
        lastError = error;
      } else {
        // خطأ حقيقي من Cloudflare (SQL غلط، صلاحيات، ...) — مفيش فايدة
        // من إعادة المحاولة، نرميه فورًا.
        throw error;
      }

      if (attempt < D1_MAX_RETRIES) {
        logger.warn(`D1 query attempt ${attempt + 1} failed (${lastError.message}), retrying...`);
        await sleep(D1_RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error(`D1 query failed after ${D1_MAX_RETRIES + 1} attempts | SQL: ${sql}`);
};

// ============================================================
// ✅ إدارة الجداول: كل "كولكشن" بيتعمله CREATE TABLE IF NOT EXISTS مرة
// واحدة بس (بنحتفظ بذاكرة الجداول اللي اتعملت خلال حياة العملية عشان
// منكررش نفس الأمر مع كل query).
// ============================================================
const ensuredTables = new Set<string>();

const ensureTable = async (collectionName: string): Promise<void> => {
  if (ensuredTables.has(collectionName)) return;
  await runD1Query(
    `CREATE TABLE IF NOT EXISTS "${collectionName}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`
  );
  ensuredTables.add(collectionName);
};

// ============================================================
// ✅ توافق مع شكل Firestore: DocumentSnapshot
// ============================================================
class D1DocSnapshot {
  constructor(
    public readonly id: string,
    public readonly exists: boolean,
    private readonly _data: any
  ) {}

  data(): any {
    return this._data;
  }
}

// ============================================================
// ✅ توافق مع شكل Firestore: DocumentReference
// ============================================================
class D1DocRef {
  constructor(
    private readonly collectionName: string,
    public readonly id: string
  ) {}

  async get(): Promise<D1DocSnapshot> {
    await ensureTable(this.collectionName);
    const rows = await runD1Query(`SELECT data FROM "${this.collectionName}" WHERE id = ?`, [this.id]);
    if (rows.length === 0) return new D1DocSnapshot(this.id, false, undefined);
    return new D1DocSnapshot(this.id, true, JSON.parse(rows[0].data));
  }

  async set(data: any): Promise<void> {
    await ensureTable(this.collectionName);
    const payload = JSON.stringify({ ...data, id: this.id });
    await runD1Query(
      `INSERT INTO "${this.collectionName}" (id, data) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
      [this.id, payload]
    );
  }

  async update(partial: any): Promise<void> {
    const snap = await this.get();
    if (!snap.exists) {
      throw new Error(`No document to update: ${this.collectionName}/${this.id}`);
    }
    const merged = { ...snap.data(), ...partial };
    await this.set(merged);
  }

  async delete(): Promise<void> {
    await ensureTable(this.collectionName);
    await runD1Query(`DELETE FROM "${this.collectionName}" WHERE id = ?`, [this.id]);
  }
}

// ============================================================
// ✅ توافق مع شكل Firestore: QuerySnapshot
// ============================================================
class D1QuerySnapshot {
  public readonly docs: Array<{ id: string; exists: true; data: () => any }>;

  constructor(rows: Array<{ id: string; data: any }>) {
    this.docs = rows.map(r => ({ id: r.id, exists: true as const, data: () => r.data }));
  }

  get size(): number {
    return this.docs.length;
  }

  forEach(callback: (doc: { id: string; exists: true; data: () => any }) => void): void {
    this.docs.forEach(callback);
  }
}

type WhereOp = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in';
interface WhereClause {
  field: string;
  op: WhereOp;
  value: any;
}
interface OrderClause {
  field: string;
  direction: 'asc' | 'desc';
}

const matchWhere = (data: any, clause: WhereClause): boolean => {
  const value = data ? data[clause.field] : undefined;
  switch (clause.op) {
    case '==':
      return value === clause.value;
    case '!=':
      return value !== clause.value;
    case '>':
      return value > clause.value;
    case '>=':
      return value >= clause.value;
    case '<':
      return value < clause.value;
    case '<=':
      return value <= clause.value;
    case 'in':
      return Array.isArray(clause.value) && clause.value.includes(value);
    default:
      return true;
  }
};

// ============================================================
// ✅ توافق مع شكل Firestore: Query (where/orderBy/limit قابلين للتسلسل)
// ============================================================
// ✅ ملحوظة أداء: الفلترة/الترتيب هنا بتحصل في الذاكرة (JS) بعد ما نجيب
// كل صفوف الكولكشن من D1، مش عن طريق WHERE في الـ SQL نفسه. ده مقصود
// عشان نحافظ على نفس سلوك Firestore (فلترة على أي حقل جوه JSON من غير
// ما نحتاج نصمم عمود SQL منفصل لكل حقل في كل موديول). بالنسبة لحجم
// بيانات نظام زي ده (مش ملايين السجلات) الأداء ده كافي جدًا.
class D1Query {
  protected wheres: WhereClause[] = [];
  protected orders: OrderClause[] = [];
  protected limitCount: number | null = null;

  constructor(protected readonly collectionName: string) {}

  protected clone(): D1Query {
    const q = new D1Query(this.collectionName);
    q.wheres = [...this.wheres];
    q.orders = [...this.orders];
    q.limitCount = this.limitCount;
    return q;
  }

  where(field: string, op: WhereOp, value: any): D1Query {
    const q = this.clone();
    q.wheres.push({ field, op, value });
    return q;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): D1Query {
    const q = this.clone();
    q.orders.push({ field, direction });
    return q;
  }

  limit(n: number): D1Query {
    const q = this.clone();
    q.limitCount = n;
    return q;
  }

  async get(): Promise<D1QuerySnapshot> {
    await ensureTable(this.collectionName);
    const rows = await runD1Query(`SELECT id, data FROM "${this.collectionName}"`);
    let docs = rows.map(r => ({ id: r.id as string, data: JSON.parse(r.data) }));

    docs = docs.filter(d => this.wheres.every(w => matchWhere(d.data, w)));

    // نطبّق الترتيب بترتيب عكسي للمعايير عشان أول orderBy يبقى هو الأهم
    // (نفس سلوك ترتيب متعدد المعايير في SQL/Firestore)
    for (const order of [...this.orders].reverse()) {
      docs.sort((a, b) => {
        const av = a.data ? a.data[order.field] : undefined;
        const bv = b.data ? b.data[order.field] : undefined;
        let cmp = 0;
        if (av > bv) cmp = 1;
        else if (av < bv) cmp = -1;
        return order.direction === 'desc' ? -cmp : cmp;
      });
    }

    if (this.limitCount !== null) {
      docs = docs.slice(0, this.limitCount);
    }

    return new D1QuerySnapshot(docs);
  }
}

// ============================================================
// ✅ توافق مع شكل Firestore: CollectionReference
// ============================================================
class D1Collection extends D1Query {
  get id(): string {
    return this.collectionName;
  }

  doc(id?: string): D1DocRef {
    return new D1DocRef(this.collectionName, id || randomUUID());
  }
}

// ============================================================
// ✅ توافق مع شكل Firestore: Firestore (الجذر db.collection(...))
// ============================================================
class D1Database {
  collection(name: string): D1Collection {
    return new D1Collection(name);
  }
}

// أنواع مساعدة تستخدم بدل FirebaseFirestore.* في باقي الكود
export type { D1Database, D1Collection, D1Query, D1DocRef, D1DocSnapshot, D1QuerySnapshot };

let d1db: D1Database | null = null;

export const initializeD1 = (): D1Database => {
  if (!d1db) {
    // نتأكد من وجود المتغيرات دلوقتي عشان نفشل بدري وبوضوح لو ناقصة،
    // بدل ما نكتشف المشكلة بعد أول query فاشل
    getConfig();
    d1db = new D1Database();
    logger.info('✅ Cloudflare D1 initialized successfully');
  }
  return d1db;
};

export const getFirestore = (): D1Database => {
  if (!d1db) initializeD1();
  return d1db as D1Database;
};

export default { initializeD1, getFirestore };