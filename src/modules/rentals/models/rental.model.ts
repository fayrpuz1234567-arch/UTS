// C:\Users\Amir\fleet-erp\backend\src\modules\rentals\models\rental.model.ts

export interface Rental {
  id: string;
  rentalNumber: string;
  vehicleId: string;
  driverId?: string;
  entityId?: string;              // ✅ رابط الجهة (العميل)
  entityName?: string;            // ✅ اسم الجهة
  renterName?: string;            // اسم المستأجر (بديل)
  renterPhone?: string;
  startDate: string;
  endDate: string;
  startKM?: number;
  endKM?: number;
  totalKM?: number;
  rentalType: 'daily' | 'weekly' | 'monthly' | 'hourly';
  unitPrice: number;
  totalPrice: number;
  discount?: number;
  finalPrice?: number;
  paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue';
  paymentMethod?: 'cash' | 'bank_transfer' | 'credit_card' | 'check';
  invoiceNumber?: string;
  notes?: string;
  attachments?: string[];
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'overdue';
  approvedBy?: string;
  approvedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  completedAt?: string;
  completedBy?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
  metadata?: Record<string, any>;
  
  // ✅ إضافة حقول جديدة للتقرير
  destination?: string;           // وجهة السفر
  vehicleType?: string;           // نوع السيارة
  days?: number;                  // عدد الأيام
  orderNumber?: string;           // ✅ رقم أمر التشغيل (يُدخل يدوياً)
  rentalValue?: number;           // القيمة الإيجارية
  overnight?: number;             // عدد ليالي المبيت
  overnightRate?: number;         // ✅ سعر ليلة المبيت
  overnightTotal?: number;        // ✅ إجمالي المبيت
  account?: string;               // حساب الجهة
  paymentData?: string;           // بيانات السداد
  driverName?: string;            // اسم السائق
  plateNumber?: string;           // رقم السيارة

  // ✅ فئة الإيجار (داخلي / خارجي) — انتقلت من الكيانات (العملاء) إلى الإيجار
  rentalCategory?: 'internal' | 'external';

  // ✅ بدل السائق
  driverAllowance?: number;

  // ✅ إنهاء الإيجار (نفس منطق إنهاء المأمورية)
  actualEndDate?: string;         // تاريخ الإنهاء الفعلي
  endReason?: string;             // سبب الإنهاء
  endNotes?: string;              // ملاحظات الإنهاء
}

export interface CreateRentalDTO {
  rentalNumber?: string;          // ✅ أصبح اختيارياً — البديل هو رقم أمر التشغيل
  vehicleId: string;
  driverId?: string;
  entityId?: string;              // ✅ رابط الجهة
  entityName?: string;
  renterName?: string;
  renterPhone?: string;
  startDate: string;
  endDate: string;
  startKM?: number;
  rentalType: 'daily' | 'weekly' | 'monthly' | 'hourly';
  unitPrice: number;
  discount?: number;
  paymentMethod?: 'cash' | 'bank_transfer' | 'credit_card' | 'check';
  notes?: string;
  
  // ✅ إضافة حقول جديدة
  destination?: string;
  vehicleType?: string;
  days?: number;
  orderNumber?: string;           // ✅ رقم أمر التشغيل (يدوي)
  rentalValue?: number;
  overnight?: number;
  overnightRate?: number;
  overnightTotal?: number;
  account?: string;
  paymentData?: string;
  driverName?: string;
  plateNumber?: string;
  rentalCategory?: 'internal' | 'external';
  driverAllowance?: number;
}

export interface UpdateRentalDTO {
  entityId?: string;
  entityName?: string;
  renterName?: string;
  renterPhone?: string;
  endDate?: string;
  endKM?: number;
  totalKM?: number;
  unitPrice?: number;
  totalPrice?: number;
  discount?: number;
  finalPrice?: number;
  paymentStatus?: 'pending' | 'partial' | 'paid' | 'overdue';
  paymentMethod?: 'cash' | 'bank_transfer' | 'credit_card' | 'check';
  invoiceNumber?: string;
  notes?: string;
  status?: 'pending' | 'active' | 'completed' | 'cancelled' | 'overdue';
  
  // ✅ إضافة حقول جديدة
  destination?: string;
  vehicleType?: string;
  days?: number;
  orderNumber?: string;           // ✅ رقم أمر التشغيل (يدوي)
  rentalValue?: number;
  overnight?: number;
  overnightRate?: number;
  overnightTotal?: number;
  account?: string;
  paymentData?: string;
  driverName?: string;
  plateNumber?: string;
  rentalCategory?: 'internal' | 'external';
  driverAllowance?: number;
  actualEndDate?: string;
  endReason?: string;
  endNotes?: string;
}