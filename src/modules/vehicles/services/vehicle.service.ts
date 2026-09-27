import { VehicleRepository } from '../repositories/vehicle.repository';
import { Vehicle, CreateVehicleDTO, UpdateVehicleDTO } from '../models/vehicle.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { logger } from '../../../core/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { MissionRepository } from '../../missions/repositories/mission.repository';
import { RentalRepository } from '../../rentals/repositories/rental.repository';
import { FuelLogRepository } from '../../fuel/repositories/fuel.repository';

export class VehicleService {
  private missionRepo: MissionRepository;
  private rentalRepo: RentalRepository;
  private fuelLogRepo: FuelLogRepository;

  constructor(private vehicleRepo: VehicleRepository) {
    // ✅ FIX: بنستخدمهم بس للقراءة عشان نحسب إحصائيات مرتبطة بالسيارة
    // (مأموريات/إيجارات/وقود) من غير ما نعدي على راوتس الموديولات دي
    // (اللي محمية بصلاحية صفحة منفصلة). شوف getRelatedStats تحت.
    this.missionRepo = new MissionRepository();
    this.rentalRepo = new RentalRepository();
    this.fuelLogRepo = new FuelLogRepository();
  }

  async createVehicle(data: CreateVehicleDTO): Promise<Vehicle> {
    // Check if plate number exists
    const existingPlate = await this.vehicleRepo.findByPlateNumber(data.plateNumber);
    if (existingPlate) {
      throw new AppError('Vehicle with this plate number already exists', 409);
    }

    // Check if internal code exists
    const existingCode = await this.vehicleRepo.findByInternalCode(data.internalCode);
    if (existingCode) {
      throw new AppError('Vehicle with this internal code already exists', 409);
    }

    const vehicle = await this.vehicleRepo.create({
      ...data,
      currentKM: data.currentKM || 0,
      status: 'available',
      isActive: true,
      version: 1,
      qrCode: `VEH-${uuidv4().substring(0, 8)}`,
      barcode: `VEH-${Date.now()}`
    });

    logger.info(`Vehicle created: ${vehicle.plateNumber} (${vehicle.id})`);
    return vehicle;
  }

  async getVehicle(id: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findById(id);
    if (!vehicle) {
      throw new AppError('Vehicle not found', 404);
    }
    return vehicle;
  }

  async getAllVehicles(filter?: any): Promise<Vehicle[]> {
    return this.vehicleRepo.findAll({ filter });
  }

  async updateVehicle(id: string, data: UpdateVehicleDTO): Promise<Vehicle> {
    const vehicle = await this.getVehicle(id);
    
    if (data.plateNumber && data.plateNumber !== vehicle.plateNumber) {
      const existing = await this.vehicleRepo.findByPlateNumber(data.plateNumber);
      if (existing) {
        throw new AppError('Vehicle with this plate number already exists', 409);
      }
    }

    const updated = await this.vehicleRepo.update(id, data);
    if (!updated) {
      throw new AppError('Failed to update vehicle', 500);
    }

    logger.info(`Vehicle updated: ${updated.plateNumber} (${updated.id})`);
    return updated;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    await this.getVehicle(id);
    const result = await this.vehicleRepo.softDelete(id);
    logger.info(`Vehicle deleted: ${id}`);
    return result;
  }

  async updateVehicleKM(id: string, newKM: number): Promise<Vehicle> {
    const vehicle = await this.getVehicle(id);
    
    if (newKM < vehicle.currentKM) {
      throw new AppError('New KM cannot be less than current KM', 400);
    }

    const updated = await this.vehicleRepo.updateKM(id, newKM);
    if (!updated) {
      throw new AppError('Failed to update KM', 500);
    }

    logger.info(`Vehicle KM updated: ${updated.plateNumber} - ${updated.currentKM}`);
    return updated;
  }

  async updateVehicleStatus(id: string, status: Vehicle['status']): Promise<Vehicle> {
    await this.getVehicle(id);
    
    const validStatuses: Vehicle['status'][] = ['available', 'in_mission', 'in_rental', 'under_maintenance', 'out_of_service', 'retired'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid status', 400);
    }

    const updated = await this.vehicleRepo.updateStatus(id, status);
    if (!updated) {
      throw new AppError('Failed to update status', 500);
    }

    logger.info(`Vehicle status updated: ${updated.plateNumber} - ${updated.status}`);
    return updated;
  }

  async getAvailableVehicles(): Promise<Vehicle[]> {
    return this.vehicleRepo.findAvailable();
  }

  async getVehiclesByStatus(status: Vehicle['status']): Promise<Vehicle[]> {
    return this.vehicleRepo.findByStatus(status);
  }

  // ============================================================
  // ✅ FIX: إحصائيات السيارات المرتبطة (مأموريات/إيجارات/وقود)
  // ============================================================
  // المشكلة: صفحة السيارات كانت بتنادي /missions و /rentals و /fuel/logs
  // مباشرة من الفرونت إند عشان تحسب عدد المأموريات/الإيجارات وتكلفة
  // الوقود لكل سيارة. الراوتس دي محمية بصلاحية صفحة منفصلة (missions/
  // rentals/fuel)، فلو الأكونت معاه صلاحية "السيارات" بس، الطلبات دي
  // بترجع 403 ويطلع صفر في كل حاجة حتى لو البيانات موجودة فعلاً.
  //
  // الحل: نحسب الإحصائيات دي هنا في الباك إند مباشرة من الـ repositories
  // (بدل ما نعدي على راوتس محمية بصلاحية تانية)، والـ endpoint نفسه
  // بيتطلب بس صلاحية "السيارات" (نفس صلاحية باقي الصفحة). المستخدم
  // أصلاً شايف بيانات السيارة نفسها، فمنطقي يشوف ملخص بسيط عن
  // مأمورياتها/إيجاراتها/وقودها من غير ما يحتاج صلاحية منفصلة على
  // موديولات تانية بالكامل.
  async getRelatedStats(vehicleIds?: string[]): Promise<Record<string, {
    missionsCount: number;
    activeMissions: number;
    missions: Array<{ number: string; date: string; status: string; totalKM: number; fuelCost: number; entity: string }>;
    rentalsCount: number;
    rentals: Array<{ number: string; startDate: string; endDate: string; status: string; total: number; entity: string }>;
    fuelCost: number;
    fuelQuantity: number;
    fuelLogs: any[];
  }>> {
    const [missions, rentals, fuelLogs] = await Promise.all([
      this.missionRepo.findAll({}),
      this.rentalRepo.findAll({}),
      this.fuelLogRepo.findAll({})
    ]);

    const ids = vehicleIds && vehicleIds.length
      ? vehicleIds
      : Array.from(new Set([
          ...missions.map((m: any) => m.vehicleId),
          ...rentals.map((r: any) => r.vehicleId),
          ...fuelLogs.map((f: any) => f.vehicleId)
        ].filter(Boolean)));

    const result: Record<string, any> = {};

    ids.forEach(id => {
      const vehicleMissions = missions.filter((m: any) => m.vehicleId === id);
      const vehicleRentals = rentals.filter((r: any) => r.vehicleId === id);
      const vehicleFuel = fuelLogs.filter((f: any) => f.vehicleId === id);

      const totalFuelCost = vehicleFuel.reduce((sum: number, f: any) => sum + (f.totalCost || 0), 0);
      const totalFuelQuantity = vehicleFuel.reduce((sum: number, f: any) => sum + (f.fuelQuantity || 0), 0);

      result[id] = {
        missionsCount: vehicleMissions.length,
        activeMissions: vehicleMissions.filter((m: any) => m.status === 'active').length,
        missions: vehicleMissions.map((m: any) => ({
          number: m.missionNumber || m.orderNumber || 'N/A',
          date: m.startDate || m.createdAt || '',
          status: m.status || '',
          totalKM: m.totalKM || 0,
          fuelCost: m.fuelCost || 0,
          entity: m.entityName || ''
        })),
        rentalsCount: vehicleRentals.length,
        rentals: vehicleRentals.map((r: any) => ({
          number: r.rentalNumber || r.orderNumber || 'N/A',
          startDate: r.startDate || '',
          endDate: r.endDate || '',
          status: r.status || '',
          total: r.total || r.rentalValue || 0,
          entity: r.entityName || ''
        })),
        fuelCost: totalFuelCost,
        fuelQuantity: totalFuelQuantity,
        fuelLogs: vehicleFuel
      };
    });

    return result;
  }
}