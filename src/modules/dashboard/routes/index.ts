import { Router } from 'express';
import { authenticate } from '../../../core/middleware/auth.middleware';
import { getStats, getProfileStats, getActivities, getFuelChart, getMaintenanceChart } from '../controllers/dashboard.controller';

const router = Router();

router.get('/stats', authenticate, getStats);
router.get('/profile-stats', authenticate, getProfileStats);
router.get('/activities', authenticate, getActivities);
router.get('/fuel-chart', authenticate, getFuelChart);
router.get('/maintenance-chart', authenticate, getMaintenanceChart);

export { router as dashboardRouter };