export interface Vehicle {
  id: string;
  internalCode: string;
  plateNumber: string;
  plateType?: string;
  vehicleType?: string;
  category?: string;
  brand: string;
  model: string;
  manufactureYear: number;
  chassisNumber?: string;
  engineNumber?: string;
  color: string;
  fuelType: 'petrol_92' | 'petrol_95' | 'diesel' | 'electric';
  tankCapacity?: number;
  currentKM: number;
  lastKMUpdate?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  garageId?: string;
  departmentId?: string;
  assignedDriverId?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  insuranceNumber?: string;
  insuranceExpiry?: string;
  status: 'available' | 'in_mission' | 'in_rental' | 'under_maintenance' | 'out_of_service' | 'retired';
  isActive: boolean;
  qrCode?: string;
  barcode?: string;
  images?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  isDeleted: boolean;
  version: number;
  metadata?: Record<string, any>;

  // ✅ الحقول الجديدة للتقارير
  operation?: string;               // التشغيل
  assignedTo?: string;              // صاحب العهدة / الجهة
  capacity?: number;                // الحمولة
  passengerCount?: number;          // عدد الركاب
  loadCapacity?: number;            // الحمولة (لوري)
  licenseStatus?: string;           // حالة الرخصة
  technicalRating?: number;         // نسبة الصلاحية الفنية
  technicalCondition?: string;      // الحالة الفنية
  bodyType?: string;                // نوع البيان (لوري نقل بجوانب)
  engineCapacity?: string;          // السعة
  cylinders?: string;               // عدد السلندرات
  licenseDate?: string;             // تاريخ الترخيص
  vehicleId?: string;               // للكروت

  // ✅ الوقود: المعدل القياسي للاستهلاك + رقم الكارت
  standardFuelConsumption?: number; // المعدل القياسي لاستهلاك الوقود (كم/لتر)
  fuelCardNumber?: string;          // رقم كارت الوقود
}

export interface CreateVehicleDTO {
  internalCode: string;
  plateNumber: string;
  plateType?: string;
  vehicleType?: string;
  category?: string;
  brand: string;
  model: string;
  manufactureYear: number;
  chassisNumber?: string;
  engineNumber?: string;
  color: string;
  fuelType: 'petrol_92' | 'petrol_95' | 'diesel' | 'electric';
  tankCapacity?: number;
  currentKM?: number;
  purchaseDate?: string;
  purchasePrice?: number;
  garageId?: string;
  departmentId?: string;
  assignedDriverId?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  insuranceNumber?: string;
  insuranceExpiry?: string;
  notes?: string;
  
  // ✅ الحقول الجديدة للتقارير
  operation?: string;
  assignedTo?: string;
  capacity?: number;
  passengerCount?: number;
  loadCapacity?: number;
  licenseStatus?: string;
  technicalRating?: number;
  technicalCondition?: string;
  bodyType?: string;
  engineCapacity?: string;
  cylinders?: string;
  licenseDate?: string;

  // ✅ الوقود: المعدل القياسي للاستهلاك + رقم الكارت
  standardFuelConsumption?: number; // المعدل القياسي لاستهلاك الوقود (كم/لتر)
  fuelCardNumber?: string;          // رقم كارت الوقود
}

export interface UpdateVehicleDTO {
  internalCode?: string;
  plateNumber?: string;
  plateType?: string;
  vehicleType?: string;
  category?: string;
  brand?: string;
  model?: string;
  manufactureYear?: number;
  chassisNumber?: string;
  engineNumber?: string;
  color?: string;
  fuelType?: 'petrol_92' | 'petrol_95' | 'diesel' | 'electric';
  tankCapacity?: number;
  currentKM?: number;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  garageId?: string;
  departmentId?: string;
  assignedDriverId?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  insuranceNumber?: string;
  insuranceExpiry?: string;
  status?: 'available' | 'in_mission' | 'in_rental' | 'under_maintenance' | 'out_of_service' | 'retired';
  notes?: string;
  
  // ✅ الحقول الجديدة للتقارير
  operation?: string;
  assignedTo?: string;
  capacity?: number;
  passengerCount?: number;
  loadCapacity?: number;
  licenseStatus?: string;
  technicalRating?: number;
  technicalCondition?: string;
  bodyType?: string;
  engineCapacity?: string;
  cylinders?: string;
  licenseDate?: string;

  // ✅ الوقود: المعدل القياسي للاستهلاك + رقم الكارت
  standardFuelConsumption?: number; // المعدل القياسي لاستهلاك الوقود (كم/لتر)
  fuelCardNumber?: string;          // رقم كارت الوقود
}