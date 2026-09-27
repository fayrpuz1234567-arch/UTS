import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export interface ExcelRow {
  [key: string]: any;
}

export class ExcelParser {
  private filePath: string;
  private workbook: XLSX.WorkBook | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  loadFile(): void {
    try {
      this.workbook = XLSX.readFile(this.filePath);
      console.log(`✅ Loaded Excel file: ${this.filePath}`);
    } catch (error) {
      console.error(`❌ Failed to load Excel file: ${error}`);
      throw error;
    }
  }

  getSheetNames(): string[] {
    if (!this.workbook) {
      throw new Error('Workbook not loaded');
    }
    return this.workbook.SheetNames;
  }

  parseSheet(sheetName: string): ExcelRow[] {
    if (!this.workbook) {
      throw new Error('Workbook not loaded');
    }
    const sheet = this.workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    return data as ExcelRow[];
  }

  parseAllSheets(): { [sheetName: string]: ExcelRow[] } {
    if (!this.workbook) {
      throw new Error('Workbook not loaded');
    }
    const result: { [sheetName: string]: ExcelRow[] } = {};
    for (const sheetName of this.workbook.SheetNames) {
      result[sheetName] = this.parseSheet(sheetName);
    }
    return result;
  }

  static parseVehicles(data: ExcelRow[]): any[] {
    return data.map(row => ({
      plateNumber: row['رقم العربة'] || row['رقم المركبة'] || '',
      brand: row['نوع البيان'] || row['اسم البيان'] || '',
      model: row['الموديل'] || '',
      manufactureYear: parseInt(row['سنة الصنع']) || 0,
      chassisNumber: row['رقم الشاسية'] || '',
      engineNumber: row['رقم الماتور'] || '',
      color: row['اللون'] || '',
      fuelType: mapFuelType(row['نوع الوقود'] || ''),
      status: mapVehicleStatus(row['الحالة الفنية للمركبة'] || ''),
      licenseNumber: row['حالة الرخصة'] || '',
      licenseExpiry: parseDate(row['انتهاء الترخيص']),
      notes: row['ملاحظات'] || '',
    }));
  }

  static parseFuelCards(data: ExcelRow[]): any[] {
    return data.map(row => ({
      plateNumber: row['رقم اللوحه'] || '',
      fuelType: mapFuelType(row['نوع المنتج'] || ''),
      cardType: row['نوع الكارت'] || '',
      cardNumber: row['رقم الكارت'] || '',
    }));
  }

  static parseRentals(data: ExcelRow[]): any[] {
    return data.map(row => ({
      startDate: parseDate(row['تاريخ بداية المأمورية']),
      endDate: parseDate(row['تاريخ نهاية المأمورية']),
      entityName: row['الجهة'] || '',
      destination: row['وجهة السفر'] || '',
      vehicleType: row['نوع السيارة'] || '',
      days: parseInt(row['عدد الأيام']) || 1,
      orderNumber: row['رقم أمر الشغل'] || '',
      rentalPrice: parseFloat(row['القيمة الايجارية']) || 0,
      totalPrice: parseFloat(row['الاجمالي']) || 0,
      account: row['حساب الجهة'] || '',
      paymentStatus: row['بيانات السداد'] || 'unpaid',
      driverName: row['السائق'] || '',
      vehiclePlate: row['رقم السيارة'] || '',
    }));
  }

  static parseMissions(data: ExcelRow[]): any[] {
    return data.map(row => ({
      orderNumber: row['رقم أمر الشغل'] || '',
      startDate: parseDate(row['تاريخ الخروج']),
      endDate: parseDate(row['تاريخ الدخول']),
      startKM: parseInt(row['عداد الخروج']) || 0,
      endKM: parseInt(row['عداد الدخول']) || 0,
      distance: parseInt(row['المسافة المقطوعة']) || 0,
      driverName: row['اسم السائق'] || '',
      route: row['خط السير'] || '',
      entityName: row['الجهة الطالبة'] || '',
      status: mapMissionStatus(row['حالة المأمورية'] || ''),
    }));
  }
}

// ===== Helper Functions =====

function mapFuelType(fuelType: string): string {
  const map: { [key: string]: string } = {
    'بنزين 92': 'petrol_92',
    'بنزين 80': 'petrol_95',
    'سولار': 'diesel',
    'كهرباء': 'electric',
  };
  return map[fuelType] || 'petrol_92';
}

function mapVehicleStatus(status: string): string {
  const map: { [key: string]: string } = {
    'ممتازة': 'available',
    'جيد جدا': 'available',
    'جيدة': 'available',
    'متوسطة': 'under_maintenance',
    'ضعيفة': 'out_of_service',
    'غير صالحة': 'out_of_service',
    'تحت الإصلاح': 'under_maintenance',
  };
  return map[status] || 'available';
}

function mapMissionStatus(status: string): string {
  const map: { [key: string]: string } = {
    'تمت': 'completed',
    'قيد التنفيذ': 'active',
    'ملغية': 'cancelled',
    'مجدولة': 'scheduled',
  };
  return map[status] || 'scheduled';
}

function parseDate(dateValue: any): string {
  if (!dateValue) return '';
  if (dateValue instanceof Date) {
    return dateValue.toISOString().split('T')[0];
  }
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    // Try parsing dd/mm/yyyy format
    const parts = dateValue.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }
  return '';
}