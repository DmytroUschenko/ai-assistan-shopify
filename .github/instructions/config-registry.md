# Config Registry Pattern

The backend uses a **central config registry** where all feature toggles and configurations are registered at startup. This is the core pattern for this application.

## How It Works

1. **Modules register defaults** in `backend/src/config-registry/config-registry.service.ts` → `onModuleInit()`
2. **Configs stored** as flat dot-path rows in Postgres: `(shopId, path, value)`
3. **Reads merge** in-memory defaults with per-shop overrides from DB
4. **Frontend accesses** via HMAC-signed requests to config.controller.ts

## Adding a New Config Field

### Step 1: Register in Backend
```typescript
// backend/src/config-registry/config-registry.service.ts
onModuleInit(): void {
  this.register(
    'ai_assistant',
    {
      general: {
        enable: true,
        newFeature: false,  // Add here
      }
    },
    {
      moduleLabel: 'AI Assistant',
      fields: {
        'general.enable': {
          groupLabel: 'General',
          keyLabel: 'Enable AI Assistant',
          fieldType: 'toggle',
        },
        'general.newFeature': {  // Add here
          groupLabel: 'General',
          keyLabel: 'New Feature',
          fieldType: 'toggle',   // or 'select'|'text'|'number'
          options: undefined,    // Required only for 'select'
        },
      },
    }
  );
}
```

### Step 2: Define Validation DTO (optional)
```typescript
// backend/src/config-registry/dtos/set-config.dto.ts
export class SetConfigDto {
  @IsString()
  @IsNotEmpty()
  path: string;

  @IsOptional()
  value?: unknown;
}
```

### Step 3: Add Frontend UI (Remix)
```typescript
// frontend/app/routes/app._index.tsx
export const loader = async ({ context }) => {
  const shop = context.shop;
  const newFeatureEnabled = await getBackendConfig(
    shop,
    'ai_assistant.general.newFeature'
  );
  return json({ newFeatureEnabled });
};
```

### Step 4: Create Migration (if adding DB schema)
```bash
cd backend
npm run migration:generate -- src/migrations/AddNewFeature
npm run migration:run
```

## Config Path Convention

All config paths use dot-notation: `namespace.group.key`

Examples:
- `ai_assistant.general.enable` — Main AI Assistant toggle
- `ai_assistant.features.newFeature` — Feature toggle
- `ai_assistant.settings.timeout` — Numeric setting
- `module_name.category.config_name` — Template

## Config Registry API

### Frontend (via backend.server.ts)
```typescript
// Get config value
const value = await getBackendConfig(shopId, 'ai_assistant.general.enable');

// Set config value
await setBackendConfig(shopId, 'ai_assistant.general.enable', true);
```

### Backend (internal)
```typescript
// Get all configs for a shop (merged with defaults)
const configs = await configRegistry.getConfigs(shopId);

// Get single config value
const value = await configRegistry.getConfig(shopId, 'ai_assistant.general.enable');

// Get metadata for frontend UI rendering
const meta = configRegistry.getNamespaceMeta('ai_assistant');
```

## Field Types

### `toggle` (Boolean)
```typescript
fieldType: 'toggle'
// Renders as checkbox/switch
// Value: true | false
```

### `text` (String)
```typescript
fieldType: 'text'
// Renders as text input
// Value: string
```

### `number` (Number)
```typescript
fieldType: 'number'
// Renders as number input
// Value: number
```

### `select` (Enumerated)
```typescript
fieldType: 'select',
options: ['option1', 'option2', 'option3']
// Renders as dropdown
// Value must be in options array
```

## Testing Config Registry

```bash
cd backend
npm test -- config-registry.service
```

Example test:
```typescript
it('should register and retrieve config', () => {
  service.register('test', { key: 'value' });
  const meta = service.getNamespaceMeta('test');
  expect(meta).toBeDefined();
});
```
