import { FuelLogRepository, FuelCardRepository, FuelStationRepository } from '../repositories/fuel.repository';
import { VehicleRepository } from '../../vehicles/repositories/vehicle.repository';
import { DriverRepository } from '../../drivers/repositories/driver.repository';
import { logger } from '../../../core/utils/logger';

// نسبة التسامح (%) بين معدل الاستهلاك الفعلي والقياسي. أي انحراف يتجاوزها (زيادة أو نقصان)
// بيتعلّم كمشتبه. لازم تفضل مطابقة لـ CONSUMPTION_TOLERANCE_PERCENT في fuel.html
export const CONSUMPTION_TOLERANCE_PERCENT = 10;

export class FuelService {
  constructor(
    private fuelLogRepo: FuelLogRepository,
    private fuelCardRepo: FuelCardRepository,
    private fuelStationRepo: FuelStationRepository,
    private vehicleRepo: VehicleRepository,
    private driverRepo: DriverRepository
  ) {}

  // ===== Fuel Logs =====

  async createFuelLog(data: any): Promise<any> {
    // ✅ التحقق من وجود السيارة وجلب المعدل القياسي للاستهلاك
    let vehicle: any = null;
    if (data.vehicleId) {
      vehicle = await this.vehicleRepo.findById(data.vehicleId);
      if (!vehicle) {
        throw new Error('Vehicle not found');
      }
      // رقم اللوحة ورقم الكارت من بيانات السيارة
      if (!data.plateNumber) data.plateNumber = vehicle.plateNumber;
      if (!data.cardNumber) data.cardNumber = vehicle.fuelCardNumber;
    }

    // ✅ التحقق من وجود السائق (اختياري)
    if (data.driverId && data.driverId !== '' && data.driverId !== 'null') {
      const driver = await this.driverRepo.findById(data.driverId);
      if (!driver) {
        throw new Error('Driver not found');
      }
      if (!data.driverName) data.driverName = driver.fullName;
    }

    // ✅ حساب التكلفة الإجمالية إذا لم تكن موجودة
    const unitPrice = Number(data.unitPrice || data.fuelPricePerUnit || 0);
    const fuelQuantity = Number(data.fuelQuantity || data.expenseQuantity || 0);
    if (!data.totalCost && fuelQuantity && unitPrice) {
      data.totalCost = fuelQuantity * unitPrice;
    }
    if (!data.expenseAmount) data.expenseAmount = data.totalCost;
    if (!data.expenseQuantity) data.expenseQuantity = fuelQuantity;

    // ============================================================
    // ✅ العداد ومعدل الاستهلاك والانحراف (كشف التلاعب في التفويل)
    // العداد السابق = عداد آخر تفويلة لنفس السيارة
    // المسافة المقطوعة = العداد الحالي - العداد السابق
    // معدل الاستهلاك = المسافة المقطوعة / عدد اللترات
    // الانحراف % = (معدل الاستهلاك - المعدل القياسي) / المعدل القياسي * 100
    // ============================================================
    const currentKM = Number(data.currentKM || 0);

    if (data.vehicleId && currentKM > 0) {
      // العداد السابق = عداد آخر تفويلة لنفس السيارة (أو عداد السيارة لو دي أول تفويلة)
      const previousKM = await this.resolvePreviousKM(data.vehicleId, vehicle, currentKM);
      this.applyConsumptionAnalysis(data, vehicle, previousKM, currentKM, fuelQuantity, Number(data.totalCost || 0));

      // ✅ تحديث عداد السيارة بالعداد الجديد
      if (vehicle && currentKM > Number(vehicle.currentKM || 0)) {
        try {
          await this.vehicleRepo.update(data.vehicleId, {
            currentKM,
            lastKMUpdate: new Date().toISOString(),
          } as any);
        } catch (err) {
          logger.warn(`تعذر تحديث عداد السيارة ${data.vehicleId}: ${err}`);
        }
      }
    }

    // ✅ تاريخ حركة الكارت
    if (!data.transactionDate) {
      data.transactionDate = data.date || new Date().toISOString();
    }

    // ✅ إضافة حالة افتراضية إذا لم تكن موجودة
    if (!data.status) {
      data.status = 'pending';
    }

    return this.fuelLogRepo.create(data);
  }

  /**
   * العداد السابق لسيارة معينة: قراءة آخر تفويلة (أعلى عداد)، وإلا عداد السيارة نفسه،
   * وإلا القراءة الحالية (يعني مفيش مسافة تتحسب).
   *
   * ✅ ملحوظة: findAll بيستبعد المحذوف (isDeleted) تلقائياً بعد الجلب،
   * فمفيش داعي لفلتر isDeleted هنا. إضافته كانت بتكسر الاستعلام تماماً:
   * Firestore بيرفض دمج فلتر عدم-مساواة (!=) على حقل مع orderBy على حقل
   * مختلف (currentKM هنا)، فكان الاستعلام بيفشل ويترجع مصفوفة فاضية دايماً
   * (الخطأ بيتبلع جوه try/catch في findAll)، وده كان بيمنع حساب معدل
   * الاستهلاك والانحراف نهائياً.
   */
  private async resolvePreviousKM(vehicleId: string, vehicle: any, currentKM: number): Promise<number> {
    const previousLogs = await this.fuelLogRepo.findAll({
      filter: { vehicleId },
      sort: { currentKM: 'desc' },
      limit: 1,
    });
    const lastLog: any = Array.isArray(previousLogs) ? previousLogs[0] : null;

    if (lastLog && Number(lastLog.currentKM) > 0) return Number(lastLog.currentKM);
    if (vehicle && Number(vehicle.currentKM) > 0) return Number(vehicle.currentKM);
    return currentKM;
  }

  /**
   * حساب المسافة المقطوعة ومعدل الاستهلاك والانحراف عن المعدل القياسي.
   * المعدل = المسافة / عدد اللترات (كم/لتر)، والانحراف % = (الفعلي - القياسي) / القياسي * 100.
   * أي انحراف أكبر من CONSUMPTION_TOLERANCE_PERCENT (زيادة أو نقصان) بيتعلّم isSuspicious:
   *   - انحراف سالب: استهلاك أعلى من القياسي → احتمال تلاعب في التفويل
   *   - انحراف موجب: استهلاك أقل من القياسي → مراجعة قراءة العداد أو الكمية
   */
  private applyConsumptionAnalysis(
    data: any,
    vehicle: any,
    previousKM: number,
    currentKM: number,
    fuelQuantity: number,
    totalCost: number
  ): void {
    data.previousKM = previousKM;

    const distance = currentKM - previousKM;
    data.distanceTraveled = distance > 0 ? distance : 0;
    data.distanceSinceLastFuel = data.distanceTraveled;

    if (data.distanceTraveled > 0 && fuelQuantity > 0) {
      // معدل الاستهلاك الفعلي (كم / لتر)
      data.consumptionRate = Number((data.distanceTraveled / fuelQuantity).toFixed(2));
      data.fuelEfficiency = data.consumptionRate;
      data.costPerKM = totalCost
        ? Number((totalCost / data.distanceTraveled).toFixed(2))
        : 0;
    }

    // المعدل القياسي من بيانات السيارة
    const standard = Number(vehicle?.standardFuelConsumption || 0);
    if (standard > 0) {
      data.standardConsumptionRate = standard;

      if (data.consumptionRate && data.consumptionRate > 0) {
        data.consumptionDeviation = Number(
          (((data.consumptionRate - standard) / standard) * 100).toFixed(2)
        );

        if (Math.abs(data.consumptionDeviation) > CONSUMPTION_TOLERANCE_PERCENT) {
          data.isSuspicious = true;
          const direction = data.consumptionDeviation < 0
            ? 'استهلاك أعلى من القياسي — احتمال تلاعب في التفويل'
            : 'استهلاك أقل من القياسي — راجع قراءة العداد أو الكمية المسجلة';
          data.suspicionReason =
            `انحراف في معدل الاستهلاك: الفعلي ${data.consumptionRate} كم/لتر ` +
            `مقابل القياسي ${standard} كم/لتر (${data.consumptionDeviation}%) — ${direction}`;
        }
      }
    }
  }

  async getAllFuelLogs(options?: {
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    vehicleId?: string;
    driverId?: string;
  }): Promise<any> {
    const filter: any = {};

    // ✅ فلترة حسب التاريخ
    if (options?.dateFrom || options?.dateTo) {
      filter.date = {};
      if (options.dateFrom) filter.date.$gte = options.dateFrom;
      if (options.dateTo) filter.date.$lte = options.dateTo;
    }

    // ✅ فلترة حسب السيارة
    if (options?.vehicleId) {
      filter.vehicleId = options.vehicleId;
    }

    // ✅ فلترة حسب السائق
    if (options?.driverId) {
      filter.driverId = options.driverId;
    }

    // ✅ فلترة حسب المأمورية

    // ✅ فلترة حسب الإيجار

    // ✅ إذا كان هناك بحث، نضيف شرط البحث
    if (options?.search) {
      const searchRegex = new RegExp(options.search, 'i');
      filter.$or = [
        { vehicleId: searchRegex },
        { driverId: searchRegex },
        { cardNumber: searchRegex },
        { fuelType: searchRegex },
      ];
    }

    const page = options?.page || 1;
    const limit = options?.limit || 10;

    const data = await this.fuelLogRepo.findAll({
      filter,
      page,
      limit,
      sort: { date: 'desc', createdAt: 'desc' } // ✅ استخدام 'desc' بدلاً من -1
    });

    const total = await this.fuelLogRepo.count(filter);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFuelLog(id: string): Promise<any> {
    const log = await this.fuelLogRepo.findById(id);
    if (!log) {
      throw new Error('Fuel log not found');
    }
    return log;
  }

  // ✅ تحديث سجل الوقود
  async updateFuelLog(id: string, data: any): Promise<any> {
    const existing = await this.fuelLogRepo.findById(id);
    if (!existing) {
      throw new Error('Fuel log not found');
    }

    // ✅ التحقق من وجود السيارة إذا تم تغييرها
    const vehicleChanged = !!data.vehicleId && data.vehicleId !== existing.vehicleId;
    let newVehicle: any = null;
    if (vehicleChanged) {
      newVehicle = await this.vehicleRepo.findById(data.vehicleId);
      if (!newVehicle) {
        throw new Error('Vehicle not found');
      }
    }

    // ✅ التحقق من وجود السائق إذا تم تغييره
    if (data.driverId !== undefined && data.driverId !== existing.driverId) {
      if (data.driverId && data.driverId !== '' && data.driverId !== 'null') {
        const driver = await this.driverRepo.findById(data.driverId);
        if (!driver) {
          throw new Error('Driver not found');
        }
      }
    }

    // ✅ إعادة حساب التكلفة الإجمالية إذا تغيرت الكمية أو السعر
    let totalCost = existing.totalCost || 0;
    let fuelQuantity = existing.fuelQuantity || 0;
    let unitPrice = existing.unitPrice || 0; // ✅ استخدام default value 0

    if (data.fuelQuantity !== undefined) {
      fuelQuantity = data.fuelQuantity;
    }
    if (data.unitPrice !== undefined) {
      unitPrice = data.unitPrice;
    }
    if (data.fuelQuantity !== undefined || data.unitPrice !== undefined) {
      totalCost = fuelQuantity * unitPrice;
      data.totalCost = totalCost;
    }

    // ✅ تحديث المسافة وكفاءة الوقود إذا تغيرت
    if (data.distanceSinceLastFuel !== undefined && data.distanceSinceLastFuel > 0) {
      if (fuelQuantity > 0) {
        data.fuelEfficiency = data.distanceSinceLastFuel / fuelQuantity;
        data.costPerKM = totalCost / data.distanceSinceLastFuel;
      }
    }

    // ✅ إعادة حساب المسافة ومعدل الاستهلاك والانحراف لما تتغير القراءة أو الكمية أو السيارة،
    // وإلا يفضل معدل الاستهلاك والتنبيه القديمين ظاهرين بعد التعديل
    if (data.currentKM !== undefined || data.fuelQuantity !== undefined || vehicleChanged) {
      const newKM = data.currentKM !== undefined ? Number(data.currentKM) : Number(existing.currentKM || 0);
      const vehicle = vehicleChanged ? newVehicle : await this.vehicleRepo.findById(existing.vehicleId);
      const previousKM = vehicleChanged
        ? await this.resolvePreviousKM(data.vehicleId, vehicle, newKM)
        : Number(existing.previousKM || 0);

      if (vehicle && newKM > 0 && previousKM > 0) {
        // تصفير النواتج القديمة قبل إعادة الحساب
        data.consumptionRate = null;
        data.fuelEfficiency = null;
        data.costPerKM = null;
        data.consumptionDeviation = null;
        data.standardConsumptionRate = null;
        data.isSuspicious = false;
        data.suspicionReason = null;
        this.applyConsumptionAnalysis(data, vehicle, previousKM, newKM, Number(fuelQuantity), Number(totalCost));
      }
    }

    const updated = await this.fuelLogRepo.update(id, data);
    if (!updated) {
      throw new Error('Failed to update fuel log');
    }

    logger.info(`Fuel log updated: ${id}`);
    return updated;
  }

  // ✅ حذف سجل الوقود
  async deleteFuelLog(id: string): Promise<boolean> {
    const existing = await this.fuelLogRepo.findById(id);
    if (!existing) {
      throw new Error('Fuel log not found');
    }

    const deleted = await this.fuelLogRepo.softDelete(id);
    if (!deleted) {
      throw new Error('Failed to delete fuel log');
    }

    logger.info(`Fuel log deleted: ${id}`);
    return true;
  }

  async verifyFuelLog(id: string, userId?: string): Promise<any> {
    const log = await this.fuelLogRepo.findById(id);
    if (!log) {
      throw new Error('Fuel log not found');
    }

    if (log.verificationStatus === 'verified') {
      throw new Error('Fuel log already verified');
    }

    const updateData: any = {
      verificationStatus: 'verified',
      verifiedAt: new Date().toISOString(),
    };

    if (userId) {
      updateData.verifiedBy = userId;
    }

    return this.fuelLogRepo.update(id, updateData);
  }

  async rejectFuelLog(id: string, reason?: string): Promise<any> {
    const log = await this.fuelLogRepo.findById(id);
    if (!log) {
      throw new Error('Fuel log not found');
    }

    if (log.verificationStatus === 'verified') {
      throw new Error('Cannot reject a verified fuel log');
    }

    const updateData: any = {
      verificationStatus: 'rejected',
      rejectedAt: new Date().toISOString(),
    };

    if (reason) {
      updateData.rejectionReason = reason;
    }

    return this.fuelLogRepo.update(id, updateData);
  }

  async getSuspiciousLogs(): Promise<any[]> {
    // ✅ جلب السجلات المشبوهة (كمية كبيرة أو تكلفة عالية أو انحراف كبير في الاستهلاك أو غير موثقة)
    // ملحوظة: بنجيب السجلات ونفلترها في الكود، لأن الفلتر القديم كان بيستخدم
    // $or كمفتاح مباشر في الفلتر ($or مش مدعوم أصلاً في applyFilters وبيتحول
    // لـ where('$or', ...) اللي مبيطابقش أي مستند)، ومع فلتر عدم-مساواة
    // (verificationStatus != verified) مع ترتيب على حقل مختلف (date) اللي
    // فايرستور بيرفضه. النتيجة كانت مصفوفة فاضية أو غلط دايماً.
    const logs = await this.fuelLogRepo.findAll({
      sort: { date: 'desc', createdAt: 'desc' },
    });

    return logs.filter((l: any) =>
      l.verificationStatus !== 'verified' &&
      (
        (l.fuelQuantity || 0) > 100 ||   // كمية كبيرة
        (l.totalCost || 0) > 5000 ||     // تكلفة عالية
        l.isSuspicious === true          // انحراف كبير في معدل الاستهلاك (تلاعب محتمل)
      )
    );
  }

  async getFuelLogsByVehicle(vehicleId: string): Promise<any[]> {
    return this.fuelLogRepo.findByVehicle(vehicleId);
  }

  async getFuelLogsByDriver(driverId: string): Promise<any[]> {
    return this.fuelLogRepo.findByDriver(driverId);
  }



  async getFuelLogsByDateRange(startDate: string, endDate: string): Promise<any[]> {
    return this.fuelLogRepo.findByDateRange(startDate, endDate);
  }

  async getAnalytics(period: string = 'month'): Promise<any> {
    // ✅ تحليلات متقدمة
    const logs = await this.fuelLogRepo.findAll({});

    const totalLogs = logs.length;
    const totalQuantity = logs.reduce((sum, l) => sum + (l.fuelQuantity || 0), 0);
    const totalCost = logs.reduce((sum, l) => sum + (l.totalCost || 0), 0);
    const totalDistance = logs.reduce((sum, l) => sum + (l.distanceSinceLastFuel || 0), 0);

    // ✅ تحليل حسب نوع الوقود
    const fuelTypeStats: Record<string, any> = {};
    logs.forEach(l => {
      const type = l.fuelType || 'unknown';
      if (!fuelTypeStats[type]) {
        fuelTypeStats[type] = { count: 0, quantity: 0, cost: 0 };
      }
      fuelTypeStats[type].count++;
      fuelTypeStats[type].quantity += l.fuelQuantity || 0;
      fuelTypeStats[type].cost += l.totalCost || 0;
    });

    // ✅ تحليل السيارات الأعلى استهلاكاً
    const vehicleStats: Record<string, any> = {};
    logs.forEach(l => {
      const vid = l.vehicleId || 'unknown';
      if (!vehicleStats[vid]) {
        vehicleStats[vid] = { quantity: 0, cost: 0, distance: 0 };
      }
      vehicleStats[vid].quantity += l.fuelQuantity || 0;
      vehicleStats[vid].cost += l.totalCost || 0;
      vehicleStats[vid].distance += l.distanceSinceLastFuel || 0;
    });

    // ترتيب السيارات الأعلى استهلاكاً
    const topVehicles = Object.entries(vehicleStats)
      .map(([id, stats]) => ({ vehicleId: id, ...stats }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      totalLogs,
      totalQuantity,
      totalCost,
      totalDistance,
      averageConsumption: totalDistance > 0 ? (totalQuantity / totalDistance) : 0,
      averageCostPerLiter: totalQuantity > 0 ? (totalCost / totalQuantity) : 0,
      averageCostPerKM: totalDistance > 0 ? (totalCost / totalDistance) : 0,
      fuelTypeStats,
      topVehicles,
      period,
    };
  }

  // ===== Fuel Cards =====

  async createFuelCard(data: any): Promise<any> {
    // ✅ التحقق من عدم وجود كارت بنفس الرقم
    if (data.cardNumber) {
      const existing = await this.fuelCardRepo.findByCardNumber(data.cardNumber);
      if (existing) {
        throw new Error('Fuel card with this number already exists');
      }
    }

    return this.fuelCardRepo.create({
      ...data,
      isActive: true,
      balance: 0,
    });
  }

  async getAllFuelCards(): Promise<any[]> {
    return this.fuelCardRepo.findAll({});
  }

  async getFuelCard(id: string): Promise<any> {
    const card = await this.fuelCardRepo.findById(id);
    if (!card) {
      throw new Error('Fuel card not found');
    }
    return card;
  }

  async updateFuelCard(id: string, data: any): Promise<any> {
    const card = await this.fuelCardRepo.findById(id);
    if (!card) {
      throw new Error('Fuel card not found');
    }
    return this.fuelCardRepo.update(id, data);
  }

  async deleteFuelCard(id: string): Promise<boolean> {
    const card = await this.fuelCardRepo.findById(id);
    if (!card) {
      throw new Error('Fuel card not found');
    }
    return this.fuelCardRepo.softDelete(id);
  }

  // ===== Fuel Stations =====

  async createFuelStation(data: any): Promise<any> {
    // ✅ التحقق من عدم وجود محطة بنفس الكود
    if (data.code) {
      const existing = await this.fuelStationRepo.findByCode(data.code);
      if (existing) {
        throw new Error('Fuel station with this code already exists');
      }
    }

    return this.fuelStationRepo.create({
      ...data,
      isActive: true,
    });
  }

  async getAllFuelStations(): Promise<any[]> {
    return this.fuelStationRepo.findAll({});
  }

  async getFuelStation(id: string): Promise<any> {
    const station = await this.fuelStationRepo.findById(id);
    if (!station) {
      throw new Error('Fuel station not found');
    }
    return station;
  }

  async updateFuelStation(id: string, data: any): Promise<any> {
    const station = await this.fuelStationRepo.findById(id);
    if (!station) {
      throw new Error('Fuel station not found');
    }
    return this.fuelStationRepo.update(id, data);
  }

  async deleteFuelStation(id: string): Promise<boolean> {
    const station = await this.fuelStationRepo.findById(id);
    if (!station) {
      throw new Error('Fuel station not found');
    }
    return this.fuelStationRepo.softDelete(id);
  }
}