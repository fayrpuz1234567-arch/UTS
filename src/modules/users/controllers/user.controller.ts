import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateUserDTO, UpdateUserDTO, ChangePasswordDTO } from '../models/user.model';
import { PAGE_REGISTRY, PAGE_READ_DEPENDENCIES, dependencyPageIds } from '../../../core/constants/pages';

export class UserController {
  constructor(private userService: UserService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateUserDTO = req.body;
    const userId = req.user?.id || 'system';
    const user = await this.userService.createUser(data, userId);

    const { passwordHash, ...result } = user;
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = await this.userService.getUser(id);

    const { passwordHash, ...result } = user;
    res.json({ success: true, data: result });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, role, search } = req.query;
    let filter: any = {};

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { username: search },
        { email: search },
        { fullName: search }
      ];
    }

    let users = await this.userService.getAllUsers(filter);

    if (role) {
      users = users.filter(u => u.roles && u.roles.includes(role as string));
    }

    const result = users.map(({ passwordHash, ...rest }) => rest);
    res.json({ success: true, data: result, count: result.length });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateUserDTO = req.body;
    const userId = req.user?.id || 'system';
    const user = await this.userService.updateUser(id, data, userId);

    const { passwordHash, ...result } = user;
    res.json({
      success: true,
      message: 'User updated successfully',
      data: result
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.userService.deleteUser(id);
    res.json({ success: true, message: 'User deleted successfully' });
  });

  changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: ChangePasswordDTO = req.body;
    await this.userService.changePassword(id, data);
    res.json({ success: true, message: 'Password changed successfully' });
  });

  adminResetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      res.status(400).json({ success: false, message: 'newPassword must be at least 6 characters' });
      return;
    }

    await this.userService.adminResetPassword(id, newPassword);
    res.json({ success: true, message: 'Password reset successfully' });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ success: false, message: 'status is required' });
      return;
    }

    const validStatuses = ['active', 'inactive', 'suspended', 'locked'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
      return;
    }

    const user = await this.userService.updateUserStatus(id, status as any);
    const { passwordHash, ...result } = user;
    res.json({
      success: true,
      message: 'User status updated successfully',
      data: result
    });
  });

  updateRoles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { roles } = req.body;

    if (!roles || !Array.isArray(roles)) {
      res.status(400).json({ success: false, message: 'roles array is required' });
      return;
    }

    const user = await this.userService.updateUserRoles(id, roles);
    const { passwordHash, ...result } = user;
    res.json({
      success: true,
      message: 'User roles updated successfully',
      data: result
    });
  });

  updatePages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { allowedPages } = req.body;

    if (!allowedPages || !Array.isArray(allowedPages)) {
      res.status(400).json({ success: false, message: 'allowedPages array is required' });
      return;
    }

    const user = await this.userService.updateUserAllowedPages(id, allowedPages);
    const { passwordHash, ...result } = user;
    res.json({
      success: true,
      message: 'User allowed pages updated successfully',
      data: result
    });
  });

  getPagesRegistry = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    // ✅ readsFrom: الصفحات اللي الصفحة دي بتقرأ منها (قراءة فقط) تلقائيًا
    // من غير ما تتفعّل لنفس الحساب — بتظهر كتلميح في لوحة التحكم.
    const data = PAGE_REGISTRY.map(page => ({
      ...page,
      readsFrom: dependencyPageIds(PAGE_READ_DEPENDENCIES[page.id])
    }));
    res.json({ success: true, data });
  });

  getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const profile = await this.userService.getProfile(userId);
    res.json({ success: true, data: profile });
  });

  updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const { fullName, phone } = req.body || {};
    const profile = await this.userService.updateMyProfile(userId, { fullName, phone });
    res.json({ success: true, message: 'تم تحديث البيانات الشخصية بنجاح', data: profile });
  });

  changeMyPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const { currentPassword, newPassword } = req.body || {};
    await this.userService.changeMyPassword(userId, currentPassword, newPassword);
    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  });

  getByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;
    const users = await this.userService.getUsersByStatus(status);
    const result = users.map(({ passwordHash, ...rest }) => rest);
    res.json({ success: true, data: result, count: result.length });
  });

  getByRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { role } = req.params;
    const users = await this.userService.getUsersByRole(role);
    const result = users.map(({ passwordHash, ...rest }) => rest);
    res.json({ success: true, data: result, count: result.length });
  });
}