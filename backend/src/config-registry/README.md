# ConfigRegistryModule

A Magento-inspired, multi-tenant configuration system for NestJS.

Each module registers its own default configuration at bootstrap time.
Per-shop overrides are persisted to the `core_config` database table and
deep-merged with the defaults on every read.

---

## Architecture

```
src/config-registry/
├── config-registry.module.ts      # @Global() module — imported once in AppModule
├── config-registry.service.ts     # get / set / getModuleConfig / getAllConfig
├── config.controller.ts           # REST API — GET/POST /config/:shopId/...
├── core-config.entity.ts          # TypeORM entity (core_config table)
├── dtos/
│   └── set-config.dto.ts          # Validated body for POST /config/:shopId
└── utils/
    └── config.utils.ts            # deepMerge, getByPath, setByPath, convertFlatPathsToObject
```

### How it works

1. Each domain module calls `registry.register(namespace, defaultConfig)` at bootstrap.
2. On a `get` / `getModuleConfig` call the service:
   - Loads the in-memory defaults for the requested namespace.
   - Fetches all `core_config` rows matching `shop_id = ? AND path LIKE 'namespace.%'`.
   - Converts the flat DB rows into a nested object.
   - Deep-merges defaults ← DB overrides (DB wins on conflict).
   - Returns the value at the requested dot-path.
3. `set` performs an `UPSERT` on `(shop_id, path)`.

### Path format

```
"namespace.group.key"
 └────────  └────── └──── arbitrary depth
 first segment = namespace (matches registered module)
```

Examples:
- `order.export.enabled`
- `order.sync.enabled`
- `customers.import.batchSize`

---

## Registering a module's config

### 1. Create a config file

```ts
// src/orders/order.config.ts
export const ORDER_CONFIG_KEY = 'order';

export const orderDefaultConfig = {
  export: {
    enabled: true,
    format: 'csv',
  },
  sync: {
    enabled: false,
  },
};
```

### 2. Convert your module to a DynamicModule

```ts
// src/orders/orders.module.ts
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigRegistryService } from '../config-registry/config-registry.service';
import { ORDER_CONFIG_KEY, orderDefaultConfig } from './order.config';
import { OrderProcessor } from './order.processor';

@Module({})
export class OrdersModule {
  static register(): DynamicModule {
    return {
      module: OrdersModule,
      providers: [
        {
          provide: 'ORDER_CONFIG',
          useFactory: (registry: ConfigRegistryService) => {
            registry.register(ORDER_CONFIG_KEY, orderDefaultConfig);
            return orderDefaultConfig;
          },
          inject: [ConfigRegistryService],
        },
        OrderProcessor,
      ],
      exports: ['ORDER_CONFIG', OrderProcessor],
    };
  }
}
```

### 3. Import with `.register()` in AppModule

```ts
// src/app.module.ts
import { ConfigRegistryModule } from './config-registry/config-registry.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    ConfigRegistryModule,        // must come before modules that inject ConfigRegistryService
    OrdersModule.register(),
    // ...
  ],
})
export class AppModule {}
```

---

## Reading config in a service

`ConfigRegistryService` is `@Global()` — inject it directly without importing the module.

```ts
import { Injectable } from '@nestjs/common';
import { ConfigRegistryService } from '../config-registry/config-registry.service';

@Injectable()
export class OrderExportService {
  constructor(private readonly config: ConfigRegistryService) {}

  async run(shopId: string): Promise<void> {
    // Single value
    const enabled = await this.config.get(shopId, 'order.export.enabled'); // true | false

    // Full namespace object (merged)
    const orderCfg = await this.config.getModuleConfig(shopId, 'order');
    // => { export: { enabled: true, format: 'csv' }, sync: { enabled: false } }
  }
}
```

---

## REST API

All routes require a valid Shopify App Bridge JWT (`Authorization: Bearer <token>`).

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/config/:shopId` | All registered namespaces, merged with DB overrides |
| `GET` | `/config/:shopId/:namespace` | Single namespace merged config |
| `GET` | `/config/:shopId/value?path=order.export.enabled` | Single value by dot-path |
| `POST` | `/config/:shopId` | Persist a value |

### POST body

```json
{
  "path": "order.export.enabled",
  "value": false
}
```

`value` can be a boolean, number, string, or JSON object.

### Example responses

```http
GET /config/shop1.myshopify.com/order
→ 200
{
  "export": { "enabled": true, "format": "csv" },
  "sync": { "enabled": false }
}

GET /config/shop1.myshopify.com/value?path=order.export.format
→ 200
"csv"

POST /config/shop1.myshopify.com
{ "path": "order.export.enabled", "value": false }
→ 200
{ "saved": true }
```

---

## Database

Table: `core_config`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `shop_id` | `varchar` | Indexed |
| `path` | `varchar` | Dot-path, e.g. `order.export.enabled`. Indexed |
| `value` | `jsonb` | Stores bool, int, varchar, or JSON objects |
| `created_at` | `timestamp` | Auto-set on insert |
| `updated_at` | `timestamp` | Auto-updated on upsert |

Unique constraint: `(shop_id, path)`

Migration: `src/database/migrations/1745798400000-AddCoreConfig.ts`

---

## Adding a new namespace (checklist)

- [ ] Create `src/<module>/<module>.config.ts` with `<MODULE>_CONFIG_KEY` and `<module>DefaultConfig`
- [ ] Convert `<Module>Module` to a `DynamicModule` with a `static register()` method
- [ ] Call `registry.register(key, defaults)` inside the `useFactory`
- [ ] Import `<Module>Module.register()` in `AppModule` (after `ConfigRegistryModule`)
