import { initializeFirebase, getFirestore } from '../src/core/config/firebase.config';
import { logger } from '../src/core/utils/logger';

initializeFirebase();
const db = getFirestore();

async function seedDatabase() {
  logger.info('🌱 Seeding database...');
  
  // Add any seed data here (optional)
  // This is for initial setup data like default roles, permissions, etc.
  
  logger.info('✅ Database seeded successfully!');
}

seedDatabase().catch(console.error);