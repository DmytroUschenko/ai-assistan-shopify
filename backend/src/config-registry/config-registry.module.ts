import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreConfig } from './core-config.entity';
import { ConfigRegistryService } from './config-registry.service';
import { ConfigController } from './config.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CoreConfig])],
  providers: [ConfigRegistryService],
  controllers: [ConfigController],
  exports: [ConfigRegistryService],
})
export class ConfigRegistryModule {}
