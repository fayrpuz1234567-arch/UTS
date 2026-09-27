import { EmployeeRepository } from '../repositories/employee.repository';
import { Employee, CreateEmployeeDTO, UpdateEmployeeDTO } from '../models/employee.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';

export class EmployeeService {
  constructor(private employeeRepo: EmployeeRepository) {}

  async createEmployee(data: CreateEmployeeDTO): Promise<Employee> {
    if (!data.fullName || !String(data.fullName).trim()) {
      throw new AppError('اسم الموظف مطلوب', 400);
    }

    // كود الموظف: يُدخل يدوياً أو يُولَّد
    const employeeCode = data.employeeCode || `EMP-${Date.now()}`;

    const existingCode = await this.employeeRepo.findByCode(employeeCode);
    if (existingCode) {
      throw new AppError('كود الموظف مستخدم من قبل', 409);
    }

    if (data.nationalId) {
      const existing = await this.employeeRepo.findByNationalId(data.nationalId);
      if (existing) {
        throw new AppError('يوجد موظف بنفس الرقم القومي', 409);
      }
    }

    const employee = await this.employeeRepo.create({
      ...data,
      employeeCode,
      employeeType: data.employeeType || 'other',
      status: data.status || 'active',
      // ✅ افتراضياً كل موظف يمكن أن يكون صاحب عهدة
      canHoldTrust: data.canHoldTrust !== undefined ? data.canHoldTrust : true,
      isDeleted: false,
      version: 1,
    } as any);

    logger.info(`Employee created: ${employee.fullName} (${employee.id})`);
    return employee;
  }

  async getEmployee(id: string): Promise<Employee> {
    const employee = await this.employeeRepo.findById(id);
    if (!employee) {
      throw new AppError('الموظف غير موجود', 404);
    }
    return employee;
  }

  async getAllEmployees(filter?: any): Promise<Employee[]> {
    return this.employeeRepo.findAll({ filter });
  }

  // ✅ الموظفون المؤهلون لحمل عهدة (تُستخدم في صفحة العهد)
  async getTrustEligibleEmployees(): Promise<Employee[]> {
    return this.employeeRepo.findTrustEligible();
  }

  async updateEmployee(id: string, data: UpdateEmployeeDTO): Promise<Employee> {
    await this.getEmployee(id);

    if (data.employeeCode) {
      const existing = await this.employeeRepo.findByCode(data.employeeCode);
      if (existing && existing.id !== id) {
        throw new AppError('كود الموظف مستخدم من قبل', 409);
      }
    }

    const updated = await this.employeeRepo.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    } as any);

    if (!updated) {
      throw new AppError('فشل تحديث بيانات الموظف', 500);
    }

    logger.info(`Employee updated: ${updated.fullName}`);
    return updated;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    await this.getEmployee(id);
    const result = await this.employeeRepo.softDelete(id);
    logger.info(`Employee deleted: ${id}`);
    return result;
  }

  async getEmployeesByStatus(status: string): Promise<Employee[]> {
    return this.employeeRepo.findByStatus(status);
  }
}
