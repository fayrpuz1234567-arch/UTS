// ============================================================
// ✅ Calendar Plan Model - FleetERP
// ------------------------------------------------------------
// "الموعد" المجدول من صفحة التقويم قبل ما يتحول لمأمورية/إيجار
// حقيقي. كان ده قبل كده متخزن محليًا في IndexedDB داخل المتصفح،
// دلوقتي بيتخزن في الباك اند (Firestore) عشان يكون مشترك بين كل
// المستخدمين ومتاح من أي جهاز، ومايتفقدش عند مسح بيانات المتصفح.
// ============================================================

export type CalendarPlanKind = 'mission' | 'rental';
export type CalendarPlanEntityType = 'internal' | 'external';
export type CalendarPlanState = 'pending' | 'creating' | 'created' | 'error';

export interface CalendarPlan {
  id: string;
  kind: CalendarPlanKind;
  date: string;                    // YYYY-MM-DD
  entityId?: string;
  entityName?: string;
  entityType?: CalendarPlanEntityType;
  vehicleId?: string;
  driverId?: string;
  startTime?: string;
  notes?: string;

  // ===== حالة المزامنة =====
  state: CalendarPlanState;
  lastError?: string;
  manualOnly?: boolean;            // خطأ 4xx: مفيش فايدة من إعادة المحاولة تلقائيًا
  createdId?: string | null;       // id المأمورية/الإيجار الفعلي بعد الإنشاء
  recordCreatedAt?: number;        // متى اتعمل السجل الفعلي (epoch ms)
  lastAttempt?: number;            // آخر محاولة إنشاء (epoch ms)
  addedAt?: number;                // متى اتضاف الموعد أول مرة (epoch ms)

  // ===== تتبّع =====
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  isDeleted: boolean;
  version: number;
}

export interface CreateCalendarPlanDTO {
  kind: CalendarPlanKind;
  date: string;
  entityId?: string;
  entityName?: string;
  entityType?: CalendarPlanEntityType;
  vehicleId?: string;
  driverId?: string;
  startTime?: string;
  notes?: string;
  state?: CalendarPlanState;
}

export interface UpdateCalendarPlanDTO {
  kind?: CalendarPlanKind;
  date?: string;
  entityId?: string;
  entityName?: string;
  entityType?: CalendarPlanEntityType;
  vehicleId?: string;
  driverId?: string;
  startTime?: string;
  notes?: string;
  state?: CalendarPlanState;
  lastError?: string;
  manualOnly?: boolean;
  createdId?: string | null;
  recordCreatedAt?: number;
  lastAttempt?: number;
  addedAt?: number;
}
