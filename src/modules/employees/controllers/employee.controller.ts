import { Request, Response } from 'express';
import { EmployeeService } from '../services/employee.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateEmployeeDTO, UpdateEmployeeDTO } from '../models/employee.model';

export class EmployeeController {
  constructor(private employeeService: EmployeeService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateEmployeeDTO = req.body;
    const employee = await this.employeeService.createEmployee(data);

    res.status(201).json({
      success: true,
      message: 'تم إضافة الموظف بنجاح',
      data: employee,
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const employee = await this.employeeService.getEmployee(id);
    res.json({ success: true, data: employee });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, department, search } = req.query;
    const filter: any = { isDeleted: { $ne: true } };

    if (status) filter.status = status;
    if (department) filter.department = department;
    if (search) {
      const regex = new RegExp(String(search), 'i');
      filter.$or = [
        { fullName: regex },
        { employeeCode: regex },
        { nationalId: regex },
        { phone: regex },
        { jobTitle: regex },
      ];
    }

    const employees = await this.employeeService.getAllEmployees(filter);
    res.json({ success: true, data: employees, count: employees.length });
  });

  // ✅ الموظفون المؤهلون لحمل عهدة — تُستخدم في قائمة "صاحب العهدة"
  getTrustEligible = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const employees = await this.employeeService.getTrustEligibleEmployees();
    res.json({ success: true, data: employees, count: employees.length });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateEmployeeDTO = req.body;
    const employee = await this.employeeService.updateEmployee(id, data);

    res.json({
      success: true,
      message: 'تم تحديث بيانات الموظف بنجاح',
      data: employee,
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.employeeService.deleteEmployee(id);
    res.json({ success: true, message: 'تم حذف الموظف بنجاح' });
  });

  getByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;
    const employees = await this.employeeService.getEmployeesByStatus(status);
    res.json({ success: true, data: employees, count: employees.length });
  });
}
