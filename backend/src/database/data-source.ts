import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: isProduction ? ['dist/**/*.entity.js'] : ['src/**/*.entity.ts'],
  migrations: isProduction ? ['dist/database/migrations/*.js'] : ['src/database/migrations/*.ts'],
  synchronize: false,
});
