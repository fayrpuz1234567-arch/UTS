import { initializeD1, getFirestore } from '../src/core/config/d1.config';
import { logger } from '../src/core/utils/logger';

initializeD1();
const db = getFirestore();

async function seedDatabase() {
  logger.info('🌱 Seeding database...');
  
  // Add any seed data here (optional)
  // This is for initial setup data like default roles, permissions, etc.
  
  logger.info('✅ Database seeded successfully!');
}

seedDatabase().catch(console.error);