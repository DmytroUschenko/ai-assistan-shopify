import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigRegistryService } from '../config-registry/config-registry.service';
import { LokteService } from './lokte.service';
import { LokteController } from './lokte.controller';

/**
 * Lokte feature module.
 * Registers its own config namespace on startup, following the arch-feature-modules
 * principle: each feature module owns its config registration.
 *
 * Config namespace: `lokte`
 * Fields:
 *   - general.enable  — toggle  (1 = enabled, 0 = disabled)
 *   - general.api_key — secret  (stored encrypted)
 *   - general.user_id — text    (used as persona_id in Lokte API calls)
 */
@Module({
  providers: [LokteService],
  controllers: [LokteController],
})
export class LokteModule implements OnModuleInit {
  constructor(private readonly configRegistry: ConfigRegistryService) {}

  onModuleInit(): void {
    this.configRegistry.register(
      'lokte',
      {
        general: {
          enable: 0,
          api_key: '',
          user_id: '',
        },
      },
      {
        moduleLabel: 'Lokte',
        fields: {
          'general.enable': {
            groupLabel: 'General',
            keyLabel: 'Enable',
            fieldType: 'toggle',
            toggleOptions: [
              { label: 'Enable', value: 1 },
              { label: 'Disable', value: 0 },
            ],
          },
          'general.api_key': {
            groupLabel: 'General',
            keyLabel: 'Api key',
            fieldType: 'secret',
          },
          'general.user_id': {
            groupLabel: 'General',
            keyLabel: 'User Id',
            fieldType: 'text',
          },
        },
      },
    );
  }
}
