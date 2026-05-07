import { Module } from '@nestjs/common';
import { DevToolsController } from './dev-tools.controller';

@Module({
  controllers: [DevToolsController],
})
export class DevToolsModule {}
