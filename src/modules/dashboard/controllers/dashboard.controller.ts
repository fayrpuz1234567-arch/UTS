import { Request, Response } from 'express';
import { asyncHandler } from '../../../core/middleware/error.middleware';
import { getFirestore } from '../../../core/config/firebase.config';

const db = getFirestore();

// ===== Types =====
interface Activity {
  id: string;
  message: string;
  icon: string;
  color: string;
  time: string;
}

// ===== Get Dashboard Stats =====
export const getStats = asyncHandler(async (req: Request, res: Response) => {
  try {
    console.log('📊 Getting dashboard stats...');

    // Get vehicles count
    const vehiclesSnapshot = await db.collection('vehicles').where('isDeleted', '==', false).get();
    const totalVehicles = vehiclesSnapshot.size;
    console.log(`✅ Total vehicles: ${totalVehicles}`);

    // Get active vehicles
    const activeVehiclesSnapshot = await db.collection('vehicles')
      .where('isDeleted', '==', false)
      .where('status', 'in', ['available', 'in_mission', 'in_rental'])
      .get();
    const activeVehicles = activeVehiclesSnapshot.size;
    console.log(`✅ Active vehicles: ${activeVehicles}`);

    // Get under maintenance vehicles
    const maintenanceSnapshot = await db.collection('vehicles')
      .where('isDeleted', '==', false)
      .where('status', '==', 'under_maintenance')
      .get();
    const underMaintenance = maintenanceSnapshot.size;
    console.log(`✅ Under maintenance: ${underMaintenance}`);

    // Get active missions
    const missionsSnapshot = await db.collection('missions')
      .where('isDeleted', '==', false)
      .where('status', '==', 'active')
      .get();
    const activeMissions = missionsSnapshot.size;
    console.log(`✅ Active missions: ${activeMissions}`);

    // Get total drivers
    const driversSnapshot = await db.collection('drivers').where('isDeleted', '==', false).get();
    const totalDrivers = driversSnapshot.size;
    console.log(`✅ Total drivers: ${totalDrivers}`);

    // ===== Get monthly fuel cost =====
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString();
    console.log(`📅 Start of month: ${startOfMonthStr}`);

    const fuelSnapshot = await db.collection('fuel_logs')
      .where('isDeleted', '==', false)
      .where('createdAt', '>=', startOfMonthStr)
      .get();
    let monthlyFuelCost = 0;
    fuelSnapshot.forEach(doc => {
      const data = doc.data();
      monthlyFuelCost += data.totalCost || 0;
    });
    console.log(`✅ Monthly fuel cost: ${monthlyFuelCost}`);

    // ===== Get monthly maintenance cost =====
    let monthlyMaintenanceCost = 0;

    // ✅ Try with createdAt first
    const maintSnapshot1 = await db.collection('maintenance_orders')
      .where('isDeleted', '==', false)
      .where('createdAt', '>=', startOfMonthStr)
      .get();

    console.log(`📊 Maintenance orders (createdAt): ${maintSnapshot1.size}`);

    if (maintSnapshot1.size > 0) {
      maintSnapshot1.forEach(doc => {
        const data = doc.data();
        // Try totalCost, then laborCost, then partsCost
        const cost = data.totalCost || data.laborCost || data.partsCost || 0;
        monthlyMaintenanceCost += cost;
        console.log(`📊 Order ${data.orderNumber || 'N/A'}: totalCost=${data.totalCost || 0}, laborCost=${data.laborCost || 0}, partsCost=${data.partsCost || 0}`);
      });
    } else {
      // ✅ If no data with createdAt, try with startDate
      console.log('📊 No maintenance orders with createdAt, trying startDate...');
      const maintSnapshot2 = await db.collection('maintenance_orders')
        .where('isDeleted', '==', false)
        .where('startDate', '>=', startOfMonthStr.split('T')[0])
        .get();

      console.log(`📊 Maintenance orders (startDate): ${maintSnapshot2.size}`);

      maintSnapshot2.forEach(doc => {
        const data = doc.data();
        const cost = data.totalCost || data.laborCost || data.partsCost || 0;
        monthlyMaintenanceCost += cost;
        console.log(`📊 Order ${data.orderNumber || 'N/A'}: totalCost=${data.totalCost || 0}, laborCost=${data.laborCost || 0}, partsCost=${data.partsCost || 0}`);
      });
    }

    console.log(`✅ Monthly maintenance cost: ${monthlyMaintenanceCost}`);

    const responseData = {
      totalVehicles,
      activeVehicles,
      underMaintenance,
      activeMissions,
      totalDrivers,
      monthlyFuelCost,
      monthlyMaintenanceCost
    };

    console.log('📊 Dashboard stats response:', responseData);

    res.json({
      success: true,
      data: responseData
    });

  } catch (error: any) {
    console.error('❌ Error getting dashboard stats:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error getting dashboard stats',
      error: error.message
    });
  }
});

// ===== Get Profile Stats =====
// ✅ إجماليات بسيطة (سيارات / مأموريات / تموين) لصفحة "الملف الشخصي".
// الصفحة دي متاحة لأي حساب مسجّل، فبدل ما تنادي على /vehicles و /missions
// و /fuel/logs (اللي محتاجة صلاحية صفحاتها وبترجّع 403 للحسابات المحدودة)،
// بتاخد الأعداد الإجمالية بس من هنا زي ما الداشبورد بيعمل بالظبط.
const countActiveDocs = async (collection: string): Promise<number> => {
  const query = db.collection(collection).where('isDeleted', '==', false);
  try {
    // count() أخف بكتير من تحميل كل المستندات (لو نسخة firebase-admin بتدعمه)
    const agg = await (query as any).count().get();
    return Number(agg.data().count) || 0;
  } catch {
    const snapshot = await query.get();
    return snapshot.size;
  }
};

export const getProfileStats = asyncHandler(async (req: Request, res: Response) => {
  try {
    const [totalVehicles, totalMissions, totalFuelLogs] = await Promise.all([
      countActiveDocs('vehicles'),
      countActiveDocs('missions'),
      countActiveDocs('fuel_logs')
    ]);

    res.json({
      success: true,
      data: { totalVehicles, totalMissions, totalFuelLogs }
    });
  } catch (error: any) {
    console.error('❌ Error getting profile stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting profile stats',
      error: error.message
    });
  }
});

// ===== Get Recent Activities =====
export const getActivities = asyncHandler(async (req: Request, res: Response) => {
  try {
    console.log('📋 Getting recent activities...');
    const activities: Activity[] = [];

    // Get recent vehicles
    const vehiclesSnapshot = await db.collection('vehicles')
      .where('isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();
    vehiclesSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        message: `🚗 تم إضافة سيارة جديدة: ${data.plateNumber || 'غير محدد'}`,
        icon: 'car',
        color: 'blue',
        time: data.createdAt ? new Date(data.createdAt).toLocaleString('ar-EG') : 'الآن'
      });
    });

    // Get recent missions
    const missionsSnapshot = await db.collection('missions')
      .where('isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();
    missionsSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        message: `📍 مأمورية جديدة: ${data.missionNumber || 'غير محدد'}`,
        icon: 'route',
        color: 'purple',
        time: data.createdAt ? new Date(data.createdAt).toLocaleString('ar-EG') : 'الآن'
      });
    });

    // Get recent maintenance orders
    const maintenanceSnapshot = await db.collection('maintenance_orders')
      .where('isDeleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();
    maintenanceSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        message: `🔧 أمر صيانة جديد: ${data.orderNumber || 'غير محدد'}`,
        icon: 'wrench',
        color: 'orange',
        time: data.createdAt ? new Date(data.createdAt).toLocaleString('ar-EG') : 'الآن'
      });
    });

    // Sort by time (most recent first)
    activities.sort((a, b) => {
      if (a.time === 'الآن') return -1;
      if (b.time === 'الآن') return 1;
      // Try to parse dates if possible
      try {
        const dateA = new Date(a.time);
        const dateB = new Date(b.time);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateB.getTime() - dateA.getTime();
        }
      } catch (e) {
        // Ignore parsing errors
      }
      return 0;
    });

    console.log(`✅ Found ${activities.length} activities`);

    res.json({
      success: true,
      data: activities.slice(0, 5)
    });

  } catch (error: any) {
    console.error('❌ Error getting activities:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error getting activities',
      error: error.message
    });
  }
});

// ===== Get Fuel Chart Data =====
export const getFuelChart = asyncHandler(async (req: Request, res: Response) => {
  try {
    console.log('📊 Getting fuel chart data...');
    const now = new Date();
    const months: string[] = [];
    const values: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();

      const snapshot = await db.collection('fuel_logs')
        .where('isDeleted', '==', false)
        .where('createdAt', '>=', start)
        .where('createdAt', '<', end)
        .get();

      let total = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        total += data.fuelQuantity || 0;
      });

      months.push(month.toLocaleDateString('ar-EG', { month: 'short' }));
      values.push(Math.round(total * 100) / 100);
    }

    console.log('✅ Fuel chart data ready');

    res.json({
      success: true,
      data: {
        labels: months,
        values: values
      }
    });

  } catch (error: any) {
    console.error('❌ Error getting fuel chart:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error getting fuel chart',
      error: error.message
    });
  }
});

// ===== Get Maintenance Chart Data =====
export const getMaintenanceChart = asyncHandler(async (req: Request, res: Response) => {
  try {
    console.log('📊 Getting maintenance chart data...');
    const now = new Date();
    const months: string[] = [];
    const values: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();

      // ✅ Try with createdAt first
      let snapshot = await db.collection('maintenance_orders')
        .where('isDeleted', '==', false)
        .where('createdAt', '>=', start)
        .where('createdAt', '<', end)
        .get();

      // ✅ If no data with createdAt, try with startDate
      if (snapshot.size === 0) {
        const startDateStr = new Date(month.getFullYear(), month.getMonth(), 1).toISOString().split('T')[0];
        const endDateStr = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString().split('T')[0];

        snapshot = await db.collection('maintenance_orders')
          .where('isDeleted', '==', false)
          .where('startDate', '>=', startDateStr)
          .where('startDate', '<', endDateStr)
          .get();
      }

      let total = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        total += data.totalCost || data.laborCost || data.partsCost || 0;
      });

      months.push(month.toLocaleDateString('ar-EG', { month: 'short' }));
      values.push(Math.round(total * 100) / 100);
    }

    console.log('✅ Maintenance chart data ready');

    res.json({
      success: true,
      data: {
        labels: months,
        values: values
      }
    });

  } catch (error: any) {
    console.error('❌ Error getting maintenance chart:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error getting maintenance chart',
      error: error.message
    });
  }
});