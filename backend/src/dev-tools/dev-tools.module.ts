import { Module, OnModuleInit } from '@nestjs/common';
import { DevToolsController } from './dev-tools.controller';
import { ConfigRegistryService } from '../config-registry/config-registry.service';

/**
 * DEV-ONLY module — registered only when NODE_ENV !== 'production'.
 *
 * Registers a `dev_testing` config namespace so QA toggles appear in the
 * Configuration UI. Remove this block (and the devOnlyModules import in
 * app.module.ts) before going to production, or simply leave it — it won't
 * load in production environments.
 */
@Module({
  controllers: [DevToolsController],
})
export class DevToolsModule implements OnModuleInit {
  constructor(private readonly configRegistry: ConfigRegistryService) {}

  onModuleInit(): void {
    this.configRegistry.register(
      'dev_testing',
      {
        general: {
          force_error: 0,
          force_not_configured: 0,
        },
      },
      {
        moduleLabel: 'Dev / Testing',
        fields: {
          'general.force_error': {
            groupLabel: 'Simulate errors',
            keyLabel: 'Force chat error response',
            fieldType: 'toggle',
            toggleOptions: [
              { label: 'Enabled', value: 1 },
              { label: 'Disabled', value: 0 },
            ],
          },
          'general.force_not_configured': {
            groupLabel: 'Simulate errors',
            keyLabel: 'Force "not configured" state',
            fieldType: 'toggle',
            toggleOptions: [
              { label: 'Enabled', value: 1 },
              { label: 'Disabled', value: 0 },
            ],
          },
        },
      },
    );
  }
}
