import BaseRepository from '../../../core/repositories/base.repository';
import { Employee } from '../models/employee.model';

export class EmployeeRepository extends BaseRepository<Employee> {
  constructor() {
    super('employees');
  }

  async findByCode(employeeCode: string): Promise<Employee | null> {
    return this.findOne({ employeeCode });
  }

  async findByNationalId(nationalId: string): Promise<Employee | null> {
    return this.findOne({ nationalId });
  }

  async findByStatus(status: string): Promise<Employee[]> {
    return this.findAll({ filter: { status } });
  }

  // ✅ الموظفون المؤهلون لحمل عهدة
  // ملحوظة: findAll() بيستبعد المحذوف (isDeleted) بعد الجلب تلقائيًا (in-memory)،
  // فمفيش داعي نحط isDeleted كفلتر جوه استعلام Firestore. كان الفلتر القديم
  // isDeleted: { $ne: true } بيتحوّل لـ where('isDeleted','!=',true) وبيتجمع
  // مع فلترين مساواة تانيين (status, canHoldTrust) — الجمع ده بيحتاج
  // composite index مش متعمول في المشروع، فالاستعلام كان بيفشل بصمت
  // (الخطأ بيتكتم جوه try/catch في findAll) ويرجّع [] دايمًا، فمكنش أي
  // موظف بيظهر في قائمة "صاحب العهدة" في صفحة العهد.
  async findTrustEligible(): Promise<Employee[]> {
    return this.findAll({
      filter: { status: 'active', canHoldTrust: true },
    });
  }
}
