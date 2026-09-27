import { RentalRepository } from '../repositories/rental.repository';
import { Rental } from '../models/rental.model';
import { AppError } from '../../../core/middleware/error.middleware';
import { v4 as uuidv4 } from 'uuid';

export class RentalService {
  constructor(private rentalRepo: RentalRepository) {}

  async getAllRentals(): Promise<Rental[]> {
    return this.rentalRepo.findAll();
  }

  async getRentalById(id: string): Promise<Rental> {
    const rental = await this.rentalRepo.findById(id);
    if (!rental) throw new AppError('Rental not found', 404);
    return rental;
  }

  /**
   * ✅ حساب عدد الأيام والإجمالي
   * - عدد الأيام: يُحسب من تاريخي البداية والنهاية إن لم يُدخل يدوياً
   * - الإيجار يقف عند تاريخ البداية: لو مفيش تاريخ نهاية، الأيام = 1
   *   والباقي يُكمَّل يدوياً عند الإنهاء
   * - الإجمالي = (سعر اليوم × عدد الأيام) + إجمالي المبيت + بدل السائق - الخصم
   */
  private computeRentalTotals(data: any): any {
    const unitPrice = Number(data.unitPrice || data.rentalValue || 0);
    const discount = Number(data.discount || 0);
    const driverAllowance = Number(data.driverAllowance || 0);

    // عدد الأيام
    let days = Number(data.days || 0);
    if (!days && data.startDate && data.endDate) {
      const diff = new Date(data.endDate).getTime() - new Date(data.startDate).getTime();
      days = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }
    if (!days) days = 1;

    // المبيت
    const overnight = Number(data.overnight || 0);
    const overnightRate = Number(data.overnightRate || 0);
    const overnightTotal = Number(data.overnightTotal ?? overnight * overnightRate);

    const rentalTotal = unitPrice * days;
    const totalPrice = rentalTotal + overnightTotal + driverAllowance;
    const finalPrice = totalPrice - discount;

    return {
      ...data,
      days,
      unitPrice,
      overnight,
      overnightRate,
      overnightTotal,
      driverAllowance,
      totalPrice,
      finalPrice,
    };
  }

  async createRental(data: any): Promise<Rental> {
    const computed = this.computeRentalTotals(data);

    // ✅ رقم أمر التشغيل يُدخل يدوياً — نتحقق من عدم تكراره
    if (computed.orderNumber) {
      const existing = await this.rentalRepo.findAll({
        filter: { orderNumber: computed.orderNumber, isDeleted: { $ne: true } },
      } as any);
      if (Array.isArray(existing) && existing.length > 0) {
        throw new AppError('رقم أمر التشغيل مستخدم من قبل', 400);
      }
    }

    const rentalData = {
      ...computed,
      id: uuidv4(),
      // رقم الإيجار الداخلي يتولد تلقائياً لو مش موجود
      rentalNumber: computed.rentalNumber || computed.orderNumber || `R-${Date.now()}`,
      status: computed.status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
      version: 1
    };
    return this.rentalRepo.create(rentalData);
  }

  async updateRental(id: string, data: any): Promise<Rental> {
    const existing = await this.getRentalById(id);
    // ✅ إعادة حساب الأيام والإجمالي بعد أي تعديل
    const computed = this.computeRentalTotals({ ...existing, ...data });
    const updated = await this.rentalRepo.update(id, {
      ...computed,
      updatedAt: new Date().toISOString()
    });
    if (!updated) throw new AppError('Failed to update rental', 500);
    return updated;
  }

  async deleteRental(id: string): Promise<boolean> {
    await this.getRentalById(id);
    return this.rentalRepo.softDelete(id);
  }

  async activateRental(id: string): Promise<Rental> {
    const rental = await this.getRentalById(id);
    if (rental.status !== 'pending') {
      throw new AppError('Only pending rentals can be activated', 400);
    }
    const updated = await this.rentalRepo.update(id, {
      status: 'active',
      updatedAt: new Date().toISOString()
    });
    if (!updated) throw new AppError('Failed to activate rental', 500);
    return updated;
  }

  /**
   * ✅ إنهاء الإيجار — بنفس منطق إنهاء المأمورية (له حالات)
   * الحالات: completed (منتهي) / cancelled (ملغي) / overdue (متأخر)
   * عند الإنهاء يتم تثبيت عدد الأيام الفعلي وإعادة حساب الإجمالي
   */
  async completeRental(
    id: string,
    payload?: {
      status?: 'completed' | 'cancelled' | 'overdue';
      actualEndDate?: string;
      endKM?: number;
      days?: number;
      overnight?: number;
      driverAllowance?: number;
      endReason?: string;
      endNotes?: string;
    }
  ): Promise<Rental> {
    const rental = await this.getRentalById(id);

    if (rental.status === 'completed' || rental.status === 'cancelled') {
      throw new AppError('هذا الإيجار منتهي بالفعل', 400);
    }
    if (rental.status !== 'active' && rental.status !== 'overdue') {
      throw new AppError('لا يمكن إنهاء إيجار غير نشط', 400);
    }

    const newStatus = payload?.status || 'completed';
    const actualEndDate = payload?.actualEndDate || new Date().toISOString();

    // ✅ الأيام الفعلية: المُدخلة يدوياً، أو محسوبة من البداية حتى تاريخ الإنهاء
    let days = Number(payload?.days || 0);
    if (!days && rental.startDate) {
      const diff = new Date(actualEndDate).getTime() - new Date(rental.startDate).getTime();
      days = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    const totalKM =
      payload?.endKM !== undefined && rental.startKM !== undefined
        ? Number(payload.endKM) - Number(rental.startKM)
        : rental.totalKM;

    const computed = this.computeRentalTotals({
      ...rental,
      days,
      overnight: payload?.overnight ?? rental.overnight,
      driverAllowance: payload?.driverAllowance ?? rental.driverAllowance,
    });

    const updated = await this.rentalRepo.update(id, {
      ...computed,
      status: newStatus,
      actualEndDate,
      endDate: actualEndDate,
      endKM: payload?.endKM ?? rental.endKM,
      totalKM,
      endReason: payload?.endReason,
      endNotes: payload?.endNotes,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    if (!updated) throw new AppError('Failed to complete rental', 500);
    return updated;
  }

  /**
   * ✅ إلغاء الإيجار
   */
  async cancelRental(id: string, reason?: string): Promise<Rental> {
    const rental = await this.getRentalById(id);
    if (rental.status === 'completed') {
      throw new AppError('لا يمكن إلغاء إيجار منتهي', 400);
    }
    const updated = await this.rentalRepo.update(id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason,
      updatedAt: new Date().toISOString(),
    } as any);
    if (!updated) throw new AppError('Failed to cancel rental', 500);
    return updated;
  }
}