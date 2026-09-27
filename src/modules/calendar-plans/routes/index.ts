import { Router } from 'express';
import { CalendarPlanController } from '../controllers/calendar-plan.controller';
import { CalendarPlanService } from '../services/calendar-plan.service';
import { CalendarPlanRepository } from '../repositories/calendar-plan.repository';
import { authenticate, requireEditAccess } from '../../../core/middleware/auth.middleware';

const router = Router();

// ===== Dependency Injection =====
const planRepo = new CalendarPlanRepository();
const planService = new CalendarPlanService(planRepo);
const planController = new CalendarPlanController(planService);

// ============================================================
// ===== Calendar Plan Routes =====
// القراءة: أي حساب معاه صفحة التقويم (سوبر أدمن / أدمن / مشاهد) — الحماية
// على مستوى الصفحة بتتم في index.ts (requirePageAccess('calendar-plans')).
// الكتابة (إضافة / تعديل / حذف موعد): سوبر أدمن أو أدمن معاه صفحة التقويم
// بس (requireEditAccess). المشاهد بيترفض بـ 403 حتى لو نادى الـ API مباشرة.
// إنشاء السجل الفعلي (مأمورية/إيجار) عند حلول الموعد محكوم بصلاحية الأدمن
// على مستوى /missions و /rentals (PAGE_CREATE_DEPENDENCIES).
// ============================================================

router.get('/', authenticate, planController.getAll);
router.get('/:id', authenticate, planController.getOne);
router.post('/', authenticate, requireEditAccess('calendar-plans'), planController.create);
router.put('/:id', authenticate, requireEditAccess('calendar-plans'), planController.update);
router.delete('/:id', authenticate, requireEditAccess('calendar-plans'), planController.delete);

export { router as calendarPlansRouter };
