import * as fs from 'fs';
import * as path from 'path';
import { initializeFirebase, getFirestore } from '../src/core/config/firebase.config';
import { logger } from '../src/core/utils/logger';

// Initialize Firebase
initializeFirebase();
const db = getFirestore();

// ===== Helper Functions =====

function generateId(): string {
  return crypto.randomUUID();
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

function normalizePlateNumber(plate: string): string {
  // Remove extra spaces and normalize
  return plate.trim().replace(/\s+/g, ' ');
}

function extractPlateParts(plate: string): { number: string; letters: string } {
  const parts = plate.trim().split(' ');
  if (parts.length >= 3) {
    return {
      number: parts[0] || '',
      letters: parts.slice(1).join(' ')
    };
  }
  return { number: plate, letters: '' };
}

// ===== Import Functions =====

async function importVehicles() {
  logger.info('📦 Importing vehicles...');
  
  // Sample vehicle data (to be replaced with Excel data later)
  const vehicles = [
    {
      internalCode: 'V-001',
      plateNumber: '١٢٣٤ ج م ص',
      brand: 'تويوتا',
      model: 'كورولا',
      manufactureYear: 2022,
      color: 'أبيض',
      fuelType: 'petrol_92' as const,
      status: 'available' as const,
      currentKM: 0,
      isActive: true,
    },
    // Add more vehicles as needed
  ];

  let count = 0;
  for (const vehicle of vehicles) {
    try {
      const id = generateId();
      const doc = db.collection('vehicles').doc(id);
      await doc.set({
        ...vehicle,
        id,
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
        isDeleted: false,
        version: 1
      });
      count++;
      logger.info(`✅ Imported vehicle: ${vehicle.plateNumber}`);
    } catch (error) {
      logger.error(`❌ Failed to import vehicle ${vehicle.plateNumber}: ${error}`);
    }
  }
  
  logger.info(`✅ Imported ${count} vehicles`);
}

async function importFuelCards() {
  logger.info('📦 Importing fuel cards...');
  
  // Sample fuel card data (to be replaced with Excel data later)
  const cards = [
    {
      cardNumber: '6377855530087302',
      cardType: 'مركبه',
      issuer: 'مصر للبترول',
      expiryDate: '2027-12-31',
      isActive: true,
    },
    // Add more cards as needed
  ];

  let count = 0;
  for (const card of cards) {
    try {
      const id = generateId();
      const doc = db.collection('fuel_cards').doc(id);
      await doc.set({
        ...card,
        id,
        balance: 0,
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
        isDeleted: false,
        version: 1
      });
      count++;
      logger.info(`✅ Imported fuel card: ${card.cardNumber}`);
    } catch (error) {
      logger.error(`❌ Failed to import fuel card ${card.cardNumber}: ${error}`);
    }
  }
  
  logger.info(`✅ Imported ${count} fuel cards`);
}

async function importDrivers() {
  logger.info('📦 Importing drivers...');
  
  // Sample driver data (to be replaced with Excel data later)
  const drivers = [
    {
      fullName: 'محمد أحمد',
      nationalId: '١٢٣٤٥٦٧٨٩٠١٢٣٤',
      phone: '01001234567',
      licenseNumber: '٥٦٧٨٩٠١٢',
      licenseType: 'درجة أولى',
      licenseExpiry: '2027-12-31',
      hireDate: '2020-01-01',
      status: 'active' as const,
      isActive: true,
    },
    // Add more drivers as needed
  ];

  let count = 0;
  for (const driver of drivers) {
    try {
      const id = generateId();
      const doc = db.collection('drivers').doc(id);
      await doc.set({
        ...driver,
        id,
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
        isDeleted: false,
        version: 1
      });
      count++;
      logger.info(`✅ Imported driver: ${driver.fullName}`);
    } catch (error) {
      logger.error(`❌ Failed to import driver ${driver.fullName}: ${error}`);
    }
  }
  
  logger.info(`✅ Imported ${count} drivers`);
}

async function importMissions() {
  logger.info('📦 Importing missions...');
  
  // Sample mission data (to be replaced with Excel data later)
  const missions = [
    {
      missionNumber: 'M-2026-001',
      vehicleId: 'VEHICLE_ID_PLACEHOLDER',
      driverId: 'DRIVER_ID_PLACEHOLDER',
      entityName: 'جامعة الإسكندرية',
      requester: 'د. أحمد محمد',
      purpose: 'نقل وفد',
      startDate: '2026-07-08',
      startTime: '08:00',
      startKM: 0,
      priority: 'high' as const,
      status: 'scheduled' as const,
      isActive: true,
    },
    // Add more missions as needed
  ];

  let count = 0;
  for (const mission of missions) {
    try {
      const id = generateId();
      const doc = db.collection('missions').doc(id);
      await doc.set({
        ...mission,
        id,
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
        isDeleted: false,
        version: 1
      });
      count++;
      logger.info(`✅ Imported mission: ${mission.missionNumber}`);
    } catch (error) {
      logger.error(`❌ Failed to import mission ${mission.missionNumber}: ${error}`);
    }
  }
  
  logger.info(`✅ Imported ${count} missions`);
}

async function importRentals() {
  logger.info('📦 Importing rentals...');
  
  // Sample rental data (to be replaced with Excel data later)
  const rentals = [
    {
      rentalNumber: 'R-2026-001',
      vehicleId: 'VEHICLE_ID_PLACEHOLDER',
      driverId: 'DRIVER_ID_PLACEHOLDER',
      entityName: 'كلية الطب',
      startDate: '2026-11-18',
      endDate: '2026-11-18',
      startKM: 0,
      rentalPrice: 2100,
      totalPrice: 2100,
      paymentStatus: 'unpaid' as const,
      status: 'active' as const,
    },
    // Add more rentals as needed
  ];

  let count = 0;
  for (const rental of rentals) {
    try {
      const id = generateId();
      const doc = db.collection('rentals').doc(id);
      await doc.set({
        ...rental,
        id,
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
        isDeleted: false,
        version: 1
      });
      count++;
      logger.info(`✅ Imported rental: ${rental.rentalNumber}`);
    } catch (error) {
      logger.error(`❌ Failed to import rental ${rental.rentalNumber}: ${error}`);
    }
  }
  
  logger.info(`✅ Imported ${count} rentals`);
}

// ===== Main Function =====

async function main() {
  logger.info('🚀 Starting data import...');
  logger.info('========================================');
  
  try {
    // Import all data
    await importVehicles();
    await importFuelCards();
    await importDrivers();
    await importMissions();
    await importRentals();
    
    logger.info('========================================');
    logger.info('✅ All data imported successfully!');
  } catch (error) {
    logger.error('❌ Import failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the import
if (require.main === module) {
  main();
}

export { importVehicles, importFuelCards, importDrivers, importMissions, importRentals };