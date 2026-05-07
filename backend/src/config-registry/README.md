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
├── config-registry.service.ts     # get / set / getModuleConfig / getAllConfig / getDecrypted
├── config.controller.ts           # REST API — GET/POST /config/...
├── config-meta.types.ts           # FieldType, ConfigFieldMeta, ConfigNamespaceMeta
├── core-config.entity.ts          # TypeORM entity (core_config table)
├── dtos/
│   ├── set-config.dto.ts          # Validated body for POST /config/:shopId
│   └── get-value-query.dto.ts     # Validated query for GET /config/:shopId/value
└── utils/
    ├── config.utils.ts            # deepMerge, getByPath, convertFlatPathsToObject
    └── encryption.utils.ts        # encrypt / decrypt / isEncryptedValue (AES-256-GCM)
```

### How it works

1. Each domain module calls `registry.register(namespace, defaultConfig, meta?)` at bootstrap.
2. On a `get` / `getModuleConfig` call the service:
   - Loads the in-memory defaults for the requested namespace.
   - Fetches all `core_config` rows matching `shop_id = ? AND path LIKE 'namespace.%'`.
   - Converts the flat DB rows into a nested object.
   - Deep-merges defaults ← DB overrides (DB wins on conflict).
   - Returns the value at the requested dot-path.
3. `set` performs an `UPSERT` on `(shop_id, path)`. Secret fields are encrypted before storage.
4. Any `secret` field value is masked as `"****"` in API responses. Use `getDecrypted()` for internal consumption.

### Path format

```
"namespace.group.key"
 └────────  └────── └──── arbitrary depth
 first segment = namespace (matches registered module)
```

Examples:
- `order.export.enabled`
- `lokte.general.api_key`
- `customers.import.batchSize`

---

## FE Rendering Metadata

Each namespace can optionally register `ConfigNamespaceMeta` alongside its defaults.
This metadata drives the configuration UI — the frontend fetches it from
`GET /config/schema` and renders the appropriate controls without any hardcoded knowledge
of individual modules.

### Types (`config-meta.types.ts`)

```ts
type FieldType = 'select' | 'text' | 'toggle' | 'number' | 'secret';

interface SelectOption {
  label: string;
  value: string | number | boolean | null;
}

interface ConfigFieldMeta {
  /** Group label for collapsible section (e.g. "General"). */
  groupLabel: string;
  /** Human-readable field label (e.g. "API Key"). */
  keyLabel: string;
  /** How the FE should render this field. */
  fieldType: FieldType;
  /** Required when fieldType === 'select'. */
  options?: SelectOption[];
  /**
   * Optional for toggle fields — exactly [onOption, offOption].
   * Lets you use typed values (e.g. 1/0) instead of plain boolean.
   */
  toggleOptions?: [SelectOption, SelectOption];
}

interface ConfigNamespaceMeta {
  /** Human-readable module label shown in FE navigation (e.g. "Order"). */
  moduleLabel: string;
  /** Field metadata keyed by namespace-relative dot-path. */
  fields: Record<string, ConfigFieldMeta>;
}
```

### Field types reference

| `fieldType` | Rendered as | Notes |
|-------------|-------------|-------|
| `text` | Text input | Plain string value |
| `number` | Number input | Stored as `number` |
| `toggle` | Toggle switch | Use `toggleOptions` to specify typed on/off values (e.g. `1`/`0`) instead of `true`/`false` |
| `select` | Dropdown | Must provide `options`; value saved is `SelectOption.value`, not the display string |
| `secret` | Password input | Value is **encrypted at rest** (AES-256-GCM); masked as `"****"` in API responses |

### Example registration with metadata

```ts
this.configRegistry.register(
  'lokte',
  {
    general: { enable: 0, api_key: '', user_id: '' },
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
        keyLabel: 'API Key',
        fieldType: 'secret',
      },
      'general.user_id': {
        groupLabel: 'General',
        keyLabel: 'User ID',
        fieldType: 'text',
      },
    },
  },
);
```

Fields sharing the same `groupLabel` are rendered together under a collapsible section header.
Multiple groups per namespace are supported — just use different `groupLabel` values.

---

## Registering a module's config

The recommended pattern is `OnModuleInit` — no dynamic module boilerplate needed.

```ts
// src/lokte/lokte.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigRegistryService } from '../config-registry/config-registry.service';

@Module({})
export class LokteModule implements OnModuleInit {
  constructor(private readonly configRegistry: ConfigRegistryService) {}

  onModuleInit(): void {
    this.configRegistry.register(
      'lokte',
      { general: { enable: 0, api_key: '', user_id: '' } },
      {
        moduleLabel: 'Lokte',
        fields: { /* ... */ },
      },
    );
  }
}
```

Then import it in `AppModule` (after `ConfigRegistryModule`):

```ts
@Module({
  imports: [
    ConfigRegistryModule,
    LokteModule,
    // ...
  ],
})
export class AppModule {}
```

> `ConfigRegistryService` is `@Global()` — it is available to all modules without
> explicitly importing `ConfigRegistryModule` in each one.

---

## Reading config in a service

```ts
@Injectable()
export class LokteService {
  constructor(private readonly config: ConfigRegistryService) {}

  async run(shopId: string): Promise<void> {
    // Single value (secret fields are returned decrypted here)
    const enabled = await this.config.get(shopId, 'lokte.general.enable'); // 0 | 1

    // Decrypt a secret field for internal use
    const apiKey = await this.config.getDecrypted(shopId, 'lokte.general.api_key');

    // Full namespace object (secret fields masked as "****")
    const cfg = await this.config.getModuleConfig(shopId, 'lokte');
    // => { general: { enable: 1, api_key: '****', user_id: 'abc' } }
  }
}
```

**Important:** `get()` returns the real decrypted value — never pass it directly to an API
response. Use `getModuleConfig()` / `getAllConfig()` for API responses; they automatically
mask secret fields.

---

## Secret field encryption

Set `CONFIG_ENCRYPTION_KEY` in your environment (32-byte hex string recommended):

```
CONFIG_ENCRYPTION_KEY=000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f
```

- Algorithm: AES-256-GCM
- If the key is not set, secret fields are stored in plaintext and a warning is logged.
- Encrypted values are stored with a structured prefix (`enc:`) to distinguish them from
  plaintext; `isEncryptedValue()` checks for this prefix before attempting decryption.

---

## REST API

All routes require a valid Shopify App Bridge JWT (`Authorization: Bearer <token>`).

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/config/schema` | FE rendering metadata for all registered namespaces |
| `GET` | `/config/schema/:namespace` | FE rendering metadata for one namespace |
| `GET` | `/config/:shopId` | All namespaces merged with DB overrides (secrets masked) |
| `GET` | `/config/:shopId/:namespace` | Single namespace merged config (secrets masked) |
| `GET` | `/config/:shopId/value?path=lokte.general.enable` | Single value by dot-path (secrets masked) |
| `POST` | `/config/:shopId` | Persist a value `{ path, value }` |

### POST body

```json
{
  "path": "lokte.general.enable",
  "value": 1
}
```

`value` can be a boolean, number, string, or JSON object.

### Example responses

```http
GET /config/schema
→ 200
{
  "lokte": {
    "moduleLabel": "Lokte",
    "fields": {
      "general.enable": { "groupLabel": "General", "keyLabel": "Enable", "fieldType": "toggle", ... },
      "general.api_key": { "groupLabel": "General", "keyLabel": "API Key", "fieldType": "secret" }
    }
  }
}

GET /config/shop1.myshopify.com/lokte
→ 200
{
  "general": { "enable": 1, "api_key": "****", "user_id": "u_123" }
}

POST /config/shop1.myshopify.com
{ "path": "lokte.general.api_key", "value": "my-secret-token" }
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
| `path` | `varchar` | Dot-path, e.g. `lokte.general.enable`. Indexed |
| `value` | `jsonb` | Stores bool, int, string, or JSON objects. Encrypted strings for secret fields |
| `created_at` | `timestamp` | Auto-set on insert |
| `updated_at` | `timestamp` | Auto-updated on upsert |

Unique constraint: `(shop_id, path)`

Migration: `src/database/migrations/1745798400000-AddCoreConfig.ts`

---

## Adding a new namespace (checklist)

- [ ] Create `src/<module>/<module>.module.ts` implementing `OnModuleInit`
- [ ] Call `registry.register(namespace, defaults, meta?)` inside `onModuleInit()`
- [ ] Define `ConfigNamespaceMeta` with `moduleLabel` and one `ConfigFieldMeta` per field
- [ ] Use `groupLabel` to group related fields into collapsible sections in the FE
- [ ] Mark sensitive fields with `fieldType: 'secret'` — they will be encrypted automatically
- [ ] Import the module in `AppModule` (after `ConfigRegistryModule`)
- [ ] Ensure `CONFIG_ENCRYPTION_KEY` is set in production if any `secret` fields are used
