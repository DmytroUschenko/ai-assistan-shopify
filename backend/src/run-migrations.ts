import 'reflect-metadata';
import { AppDataSource } from './database/data-source';

async function runMigrations() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  try {
    await AppDataSource.runMigrations();
    console.log('✓ Migrations executed successfully');
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    await AppDataSource.destroy();
    process.exit(1);
  }
}

runMigrations();
