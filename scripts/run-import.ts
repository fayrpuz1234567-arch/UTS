import { ExcelParser } from './excel-parser';
import { importVehicles, importFuelCards, importDrivers, importMissions, importRentals } from './import-data';
import { logger } from '../src/core/utils/logger';
import * as path from 'path';

async function runImport() {
  logger.info('🚀 FleetERP Data Import');
  logger.info('========================================');
  
  // Import vehicles from Excel
  const vehicleFile = path.join(__dirname, '../data/vehicles.xlsx');
  // const vehicleData = ExcelParser.parseVehicles(parser.parseSheet('Sheet1'));
  
  // Import fuel cards from Excel
  const cardFile = path.join(__dirname, '../data/fuel-cards.xlsx');
  // const cardData = ExcelParser.parseFuelCards(parser.parseSheet('Sheet1'));
  
  // Import rentals from Excel
  const rentalFile = path.join(__dirname, '../data/rentals.xlsx');
  // const rentalData = ExcelParser.parseRentals(parser.parseSheet('Sheet1'));
  
  // Import missions from Excel
  const missionFile = path.join(__dirname, '../data/missions.xlsx');
  // const missionData = ExcelParser.parseMissions(parser.parseSheet('Sheet1'));
  
  // Run imports
  await importVehicles();
  await importFuelCards();
  await importDrivers();
  await importMissions();
  await importRentals();
  
  logger.info('========================================');
  logger.info('✅ Import completed successfully!');
}

runImport().catch(console.error);