import { Module, OnModuleInit } from '@nestjs/common';
import { LokteController } from './lokte.controller';
import { LokteService } from './lokte.service';
import { ConfigRegistryService } from '../config-registry/config-registry.service';

@Module({
  controllers: [LokteController],
  providers: [LokteService],
})
export class LokteModule implements OnModuleInit {
  constructor(private readonly configRegistry: ConfigRegistryService) {}

  onModuleInit(): void {
    this.configRegistry.register(
      'lokte',
      {
        connection: {
          enabled: false,
          api_key: '',
          persona_id: 238,
        },
      },
      {
        moduleLabel: 'Lokte Connection',
        fields: {
          'connection.enabled': {
            groupLabel: 'Connection',
            keyLabel: 'Enabled',
            fieldType: 'toggle',
          },
          'connection.api_key': {
            groupLabel: 'Connection',
            keyLabel: 'API Key',
            fieldType: 'encrypted',
          },
          'connection.persona_id': {
            groupLabel: 'Connection',
            keyLabel: 'Persona ID',
            fieldType: 'number',
          },
        },
      },
    );
  }
}
