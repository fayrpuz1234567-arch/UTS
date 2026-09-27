// ===== Fuel Log Model =====
export interface FuelLog {
  id: string;
  vehicleId: string;
  driverId: string;
  fuelCardId?: string;
  fuelStationId?: string;
  
  
  currentKM: number;
  previousKM: number;
  distanceSinceLastFuel?: number;
  fuelQuantity: number;
  fuelPricePerUnit: number;
  unitPrice: number;               // ✅ إضافة unitPrice كمرادف لـ fuelPricePerUnit
  totalCost: number;
  fuelType: 'petrol_92' | 'petrol_95' | 'diesel' | 'electric';
  receiptImage?: string;
  odometerImage?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  fuelLevelBefore?: number;
  fuelLevelAfter?: number;
  engineHours?: number;
  fuelEfficiency?: number;
  costPerKM?: number;

  // ✅ بيانات كشف استهلاك الكروت
  cardNumber?: string;             // رقم الكارت
  stationCode?: string;            // كود المحطة
  stationName?: string;            // اسم المحطة
  ticketNumber?: string;           // رقم التذكرة
  transactionDate?: string;        // تاريخ حركة الكارت
  productName?: string;            // اسم المنتج
  plateNumber?: string;            // رقم اللوحة
  driverName?: string;             // اسم السائق
  expenseAmount?: number;          // قيمة المصروف
  expenseQuantity?: number;        // كمية المصروف

  // ✅ معدل الاستهلاك والانحراف
  distanceTraveled?: number;       // المسافة المقطوعة
  consumptionRate?: number;        // معدل الاستهلاك = المسافة / عدد اللترات
  standardConsumptionRate?: number;// المعدل القياسي من بيانات السيارة
  consumptionDeviation?: number;   // الانحراف %
  isSuspicious: boolean;
  suspicionReason?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  notes?: string;
  date?: string;                   // ✅ إضافة حقل التاريخ
  status?: string;                 // ✅ إضافة حقل الحالة
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  isDeleted: boolean;
}

export interface CreateFuelLogDTO {
  vehicleId: string;
  driverId?: string;               // ✅ جعل driverId اختياري
  fuelCardId?: string;
  fuelStationId?: string;


  currentKM: number;
  fuelQuantity: number;
  fuelPricePerUnit: number;
  unitPrice?: number;              // ✅ إضافة unitPrice
  fuelType: 'petrol_92' | 'petrol_95' | 'diesel' | 'electric';
  receiptImage?: string;
  odometerImage?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  date?: string;                   // ✅ إضافة حقل التاريخ
  status?: string;                 // ✅ إضافة حقل الحالة

  // ✅ بيانات كشف استهلاك الكروت
  cardNumber?: string;             // رقم الكارت
  stationCode?: string;            // كود المحطة
  stationName?: string;            // اسم المحطة
  ticketNumber?: string;           // رقم التذكرة
  transactionDate?: string;        // تاريخ حركة الكارت
  productName?: string;            // اسم المنتج
  plateNumber?: string;            // رقم اللوحة
  driverName?: string;             // اسم السائق
  expenseAmount?: number;          // قيمة المصروف
  expenseQuantity?: number;        // كمية المصروف

}

// ===== Fuel Card Model =====
export interface FuelCard {
  id: string;
  cardNumber: string;
  cardType: string;
  issuer: string;
  assignedVehicleId?: string;
  assignedDriverId?: string;
  limit?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
  balance: number;
  expiryDate: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;

  // ✅ الحقول الجديدة للتقارير
  plateNumber?: string;     // رقم اللوحة
  vehicleId?: string;       // رقم المركبة
  fuelType?: string;        // نوع الوقود
}

export interface CreateFuelCardDTO {
  cardNumber: string;
  cardType: string;
  issuer: string;
  assignedVehicleId?: string;
  assignedDriverId?: string;
  limit?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
  expiryDate: string;
  notes?: string;
  
  // ✅ الحقول الجديدة للتقارير
  plateNumber?: string;
  fuelType?: string;
}

// ===== Fuel Station Model =====
export interface FuelStation {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  company: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  manager?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
}

export interface CreateFuelStationDTO {
  code: string;
  name: string;
  nameAr: string;
  company: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  manager?: string;
  notes?: string;
}