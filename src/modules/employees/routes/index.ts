import { Router } from 'express';
import { EmployeeController } from '../controllers/employee.controller';
import { EmployeeRepository } from '../repositories/employee.repository';
import { EmployeeService } from '../services/employee.service';
import { authenticate, requireEditAccess, requirePageAccess } from '../../../core/middleware/auth.middleware';

const router = Router();

// Dependency Injection
const employeeRepo = new EmployeeRepository();
const employeeService = new EmployeeService(employeeRepo);
const employeeController = new EmployeeController(employeeService);

// ✅ الموظفون المؤهلون لحمل عهدة — لازم تسبق /:id
router.get('/trust-eligible', authenticate, requirePageAccess('employees'), employeeController.getTrustEligible);
router.get('/status/:status', authenticate, requirePageAccess('employees'), employeeController.getByStatus);

router.get('/', authenticate, requirePageAccess('employees'), employeeController.getAll);
router.get('/:id', authenticate, requirePageAccess('employees'), employeeController.getOne);

router.post('/', authenticate, requireEditAccess('employees'), employeeController.create);
router.put('/:id', authenticate, requireEditAccess('employees'), employeeController.update);
router.delete('/:id', authenticate, requireEditAccess('employees'), employeeController.delete);

export { router as employeeRouter };
