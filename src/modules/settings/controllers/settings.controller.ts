import { Request, Response } from 'express';
import { SettingsService } from '../services/settings.service';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { CreateSettingDTO, UpdateSettingDTO } from '../models/settings.model';

export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data: CreateSettingDTO = req.body;
    const userId = req.user?.id || 'system';
    const setting = await this.settingsService.createSetting(data, userId);
    res.status(201).json({
      success: true,
      message: 'Setting created successfully',
      data: setting
    });
  });

  getOne = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const setting = await this.settingsService.getSetting(id);
    res.json({ success: true, data: setting });
  });

  getByKey = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { key } = req.params;
    const setting = await this.settingsService.getSettingByKey(key);
    if (!setting) {
      res.status(404).json({ success: false, message: 'Setting not found' });
      return;
    }
    res.json({ success: true, data: setting });
  });

  getValue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { key } = req.params;
    const value = await this.settingsService.getValue(key);
    res.json({ success: true, data: { key, value } });
  });

  getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const settings = await this.settingsService.getAllSettings();
    res.json({ success: true, data: settings, count: settings.length });
  });

  getByCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { category } = req.params;
    const settings = await this.settingsService.getSettingsByCategory(category);
    res.json({ success: true, data: settings, count: settings.length });
  });

  getByCategoryAndGroup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { category, group } = req.params;
    const settings = await this.settingsService.getSettingsByCategoryAndGroup(category, group);
    res.json({ success: true, data: settings, count: settings.length });
  });

  getPublic = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const settings = await this.settingsService.getPublicSettings();
    res.json({ success: true, data: settings, count: settings.length });
  });

  getGrouped = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const grouped = await this.settingsService.getSettingsGrouped();
    res.json({ success: true, data: grouped });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateSettingDTO = req.body;
    const userId = req.user?.id || 'system';
    const setting = await this.settingsService.updateSetting(id, data, userId);
    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: setting
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await this.settingsService.deleteSetting(id);
    res.json({ success: true, message: 'Setting deleted successfully' });
  });
}