import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ShopsModule } from './shops/shops.module';
import { ConfigRegistryModule } from './config-registry/config-registry.module';
import { InitialSchema1714284000000 } from './database/migrations/1714284000000-InitialSchema';
import { AddCoreConfig1745798400000 } from './database/migrations/1745798400000-AddCoreConfig';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow<string>('DB_USERNAME'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        synchronize: false,
        autoLoadEntities: true,
        migrations: [InitialSchema1714284000000, AddCoreConfig1745798400000],
        migrationsRun: true,
      }),
    }),

    ScheduleModule.forRoot(),

    HealthModule,
    AuthModule,
    ShopsModule,
    ConfigRegistryModule,
  ],
})
export class AppModule {}
