# NestJS Backend Conventions

**IMPORTANT:** When making changes to `/backend/`, ALWAYS apply **NestJS best practices** skill and maintain strict TypeScript typing. This file documents the specific patterns and conventions used in this backend.

## Project Structure

```
backend/src/
├── main.ts                           # Bootstrap with middleware setup
├── app.module.ts                     # Root module with all imports
├── run-migrations.ts                 # Migration runner
├── auth/
│   ├── auth.module.ts               # Auth module definition
│   └── guards/
│       ├── shopify-hmac.guard.ts     # HMAC validation (server-to-server / webhooks)
│       ├── shopify-session.guard.ts  # JWT session validation (embedded frontend calls)
│       └── *.spec.ts                 # Unit tests
├── shops/
│   ├── shops.module.ts
│   ├── shops.service.ts              # Shop registration & management
│   ├── shop.entity.ts                # TypeORM entity
│   ├── shops.controller.ts           # Endpoints (guarded)
│   └── *.spec.ts
├── config-registry/                  # Core business logic
│   ├── config-registry.module.ts
│   ├── config-registry.service.ts    # onModuleInit() registers configs
│   ├── config.controller.ts          # GET/POST/PUT endpoints
│   ├── core-config.entity.ts         # TypeORM entity
│   ├── config-meta.types.ts          # FE rendering metadata types
│   ├── dtos/
│   │   ├── set-config.dto.ts         # Validation DTO
│   │   └── *.dto.ts
│   ├── utils/
│   │   └── config.utils.ts           # Path merging, helpers
│   └── *.spec.ts
├── database/
│   ├── database.module.ts            # TypeORM setup
│   ├── data-source.ts                # Connection config for CLI
│   └── migrations/
│       ├── 1714284000000-InitialSchema.ts
│       └── 1745798400000-AddCoreConfig.ts
├── health/
│   └── health.module.ts              # Basic health check
└── types/
    └── express.d.ts                  # TypeScript augmentation
```

## Dependency Injection & Module Imports

### Pattern: Async Configuration via `useFactory`

Use `forRootAsync()` with `useFactory` to defer initialization until runtime:

```typescript
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        // ... other options
      }),
    }),
  ],
})
export class AppModule {}
```

✅ **Best Practice:**
- Always inject `ConfigService` explicitly in `inject` array
- Use `config.getOrThrow<T>('KEY')` for required env vars (throws early)
- Return config object from factory

❌ **Avoid:**
- Hardcoding env values
- Using `config.get()` without type safety
- Missing error handling for missing env vars

### Pattern: Lifecycle Hooks

Implement `OnModuleInit` for one-time bootstrap logic:

```typescript
@Injectable()
export class ConfigRegistryService implements OnModuleInit {
  onModuleInit(): void {
    // Register default configs at startup
    this.register('ai_assistant', { general: { enable: true } }, metadata);
  }
}
```

**When to use:**
- `OnModuleInit` — One-time setup at app startup (register configs, create tables)
- `OnApplicationBootstrap` — After all modules ready (start external connections)
- `OnModuleDestroy` — Cleanup on shutdown (close DB pools, cancel jobs)

## Guards & Authentication

### Guard Pattern (Two Guards)

**`ShopifyHmacGuard`** — `backend/src/auth/guards/shopify-hmac.guard.ts`
- Validates HMAC body signature; supports `x-request-hmac` (internal FE→BE) and `x-shopify-hmac-sha256` (Shopify webhooks)
- Used on: `POST /shops` (shop registration)

**`ShopifySessionGuard`** — `backend/src/auth/guards/shopify-session.guard.ts`  
- Validates a Shopify session JWT from `Authorization: Bearer <token>`
- Used on: all `/config/*` endpoints

**When to apply each guard:**
- `ShopifySessionGuard` — validates Shopify session JWT from `Authorization: Bearer <token>`; apply on endpoints called by the embedded frontend (e.g., config reads/writes)
- `ShopifyHmacGuard` — validates HMAC body signature; apply on endpoints called by raw server-to-server requests or Shopify webhooks

**Guards are applied per-controller or per-handler via `@UseGuards()` decorator — NOT globally:**
```typescript
// Class-level guard (all endpoints in controller)
@UseGuards(ShopifySessionGuard)
@Controller('config')
export class ConfigController { ... }

// Handler-level guard (single endpoint)
@Post()
@UseGuards(ShopifyHmacGuard)
async registerShop(...) { ... }
```

## Controllers & Route Ordering

### Route Declaration Order (Critical)

**Static segments must be declared BEFORE parameterized ones:**

```typescript
@Controller('config')
export class ConfigController {
  // ✅ Correct: static routes first
  @Get('schema')
  getSchema() { }

  @Get(':shopId')  // parameterized route AFTER static
  getConfig(@Param('shopId') shopId: string) { }
}
```

**Why:** NestJS matches routes in declaration order. If parameterized routes come first, `schema` will match as a `:shopId` parameter.

### DTO & Validation Pattern

```typescript
// dtos/set-config.dto.ts
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class SetConfigDto {
  @IsString()
  @IsNotEmpty()
  path: string;

  @IsOptional()
  value?: unknown;
}
```

**Global validation pipe** (in `main.ts`):
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,                // Strip unknown properties
    forbidNonWhitelisted: true,     // Throw if unknown properties
    transform: true,                // Auto-transform types
  }),
);
```

## Services & Business Logic

### Pattern: Strict Typing with Generics

```typescript
type PlainObject = Record<string, unknown>;

@Injectable()
export class ConfigRegistryService {
  private registry = new Map<string, PlainObject>();

  register(
    namespace: string,
    defaultConfig: PlainObject,
    meta?: ConfigNamespaceMeta,
  ): void {
    this.registry.set(namespace, defaultConfig);
  }
}
```

✅ **Best Practice:**
- Define type aliases for complex types (`PlainObject`, `ConfigPath`)
- Use `Record<K, V>` for dynamic objects
- Use `Map<K, V>` for lookups (not plain objects)
- Generic type parameters for reusable logic

### Logger Pattern

```typescript
import { Logger, Injectable } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  doSomething() {
    this.logger.log('Operation started');
    this.logger.warn('Potential issue');
    this.logger.error('Error occurred', error);
  }
}
```

## Database & TypeORM

### Entity Definition Pattern

```typescript
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class CoreConfig {
  @PrimaryColumn()
  shopId: string;

  @PrimaryColumn()
  path: string;

  @Column()
  value: string;
}
```

✅ **Best Practice:**
- Use `@PrimaryColumn()` for multi-column primary keys
- Always define TypeScript types for columns
- Use `@Unique()` for unique constraints
- Add `@CreateDateColumn()` and `@UpdateDateColumn()` for audit trails

### Repository Pattern

```typescript
@Injectable()
export class ConfigService {
  constructor(
    @InjectRepository(CoreConfig)
    private repo: Repository<CoreConfig>,
  ) {}

  async getConfig(shopId: string, path: string): Promise<CoreConfig | null> {
    return this.repo.findOne({
      where: { shopId, path },
    });
  }

  async getAllConfigs(shopId: string): Promise<CoreConfig[]> {
    return this.repo.find({
      where: { shopId },
    });
  }
}
```

✅ **Best Practice:**
- Always inject repository with `@InjectRepository(Entity)`
- Use `findOne({ where: { ... } })` for strict WHERE clauses
- Use `find({ where: { ... } })` for lists
- Return typed entities or null (not undefined)

### Migration Pattern

```bash
cd backend

# Generate migration from entity changes
npm run migration:generate -- src/migrations/AddNewColumn

# Review the generated migration file, then apply
npm run migration:run

# Rollback if needed
npm run migration:revert
```

**Migration file naming:** `<timestamp>-<DescriptiveAction>.ts` (e.g., `1745798400000-AddCoreConfig.ts`)

## Testing

### Unit Test Pattern (Jest)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigRegistryService } from './config-registry.service';

describe('ConfigRegistryService', () => {
  let service: ConfigRegistryService;
  let mockRepo: jest.Mocked<Repository<CoreConfig>>;

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<CoreConfig>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigRegistryService,
        {
          provide: getRepositoryToken(CoreConfig),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ConfigRegistryService>(ConfigRegistryService);
  });

  it('should register config', () => {
    service.register('test', { key: 'value' });
    expect(service.getNamespaceMeta('test')).toBeDefined();
  });
});
```

**Running tests:**
```bash
npm test                           # All tests
npm test -- config-registry.service   # Specific service
npm test:e2e                       # E2E tests
npm test -- --watch               # Watch mode
```

### E2E Test Pattern (Supertest)

E2E tests live in `test/` directory and test full request-response cycles:

```bash
npm test:e2e
```

## TypeScript Strict Mode

**`tsconfig.json` enforces:**
- `"strict": true` — All strict checks enabled
- `"noImplicitAny": true` — No implicit `any` types
- `"strictNullChecks": true` — Null/undefined caught at compile time
- `"strictFunctionTypes": true` — Function parameter types checked

✅ **Best Practice:**
- Never use `any` unless absolutely necessary (document why with comment)
- Always specify return types on functions:
  ```typescript
  // ✅ Good
  async getConfig(shopId: string): Promise<CoreConfig | null> { }

  // ❌ Bad
  async getConfig(shopId: string) { }
  ```
- Use union types instead of `any`:
  ```typescript
  // ✅ Good
  value: string | number | boolean | null

  // ❌ Bad
  value: any
  ```

## Common Patterns

### Error Handling

```typescript
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

@Post('config')
async setConfig(@Body() dto: SetConfigDto): Promise<void> {
  if (!dto.path) {
    throw new BadRequestException('Path is required');
  }
  if (!authorized) {
    throw new UnauthorizedException('Invalid HMAC');
  }
}
```

**Common exceptions:**
- `BadRequestException` — Validation or malformed request (400)
- `UnauthorizedException` — Auth failure (401)
- `ForbiddenException` — Insufficient permissions (403)
- `NotFoundException` — Resource not found (404)
- `InternalServerErrorException` — Unexpected error (500)

### Async/Await Best Practices

```typescript
// ✅ Good: Wait for all operations
async setupConfigs(): Promise<void> {
  const configs = await this.repo.find();
  await this.processAll(configs);
}

// ❌ Bad: Fire-and-forget without await
async setupConfigs(): Promise<void> {
  const configs = await this.repo.find();
  this.processAll(configs); // Silently fails
}

// ✅ Good: Parallel operations
const [shops, configs] = await Promise.all([
  this.shopsRepo.find(),
  this.configsRepo.find(),
]);
```

### Config Registry Workflow

When adding a new configuration module:

1. **Define entity** (TypeORM):
   ```typescript
   @Entity()
   export class MyConfig {
     @PrimaryColumn() shopId: string;
     @Column() value: string;
   }
   ```

2. **Register in config service** (`onModuleInit()`):
   ```typescript
   this.register('my_module', { feature: { enable: false } }, metadata);
   ```

3. **Create DTO** for validation:
   ```typescript
   export class SetMyConfigDto {
     @IsBoolean() enable: boolean;
   }
   ```

4. **Expose controller endpoint** (choose the correct guard for your caller):
   ```typescript
   // Embedded frontend calls → ShopifySessionGuard (JWT Bearer token)
   @Post(':shopId')
   @UseGuards(ShopifySessionGuard)
   async setConfig(@Param('shopId') shopId: string, @Body() dto: SetMyConfigDto) { }

   // Server-to-server / webhook calls → ShopifyHmacGuard (HMAC body signature)
   @Post()
   @UseGuards(ShopifyHmacGuard)
   async registerShop(@Body() dto: RegisterShopDto) { }
   ```

## Code Style & Formatting

**No linting/formatting tool** — Follow conventions by example:
- Use PascalCase for class/interface names: `ConfigRegistryService`, `CoreConfig`
- Use camelCase for methods/properties: `getConfig()`, `isEnabled`
- Use UPPER_SNAKE_CASE for constants: `DEFAULT_TIMEOUT = 5000`
- Organize imports: NestJS → TypeORM → custom services
- Add JSDoc comments for public methods:
  ```typescript
  /**
   * Retrieves configuration for a shop and path.
   * Merges DB overrides with registered defaults.
   */
  async getConfig(shopId: string, path: string): Promise<unknown> { }
  ```

## Build & Deployment

```bash
# Development with auto-reload
npm run start:dev

# Debug mode with Node inspector on :9230
npm run start:debug

# Production build
npm run build

# Start production server
npm start
```

**Docker:** Migrations run automatically on container startup via supervisor.

## Common Gotchas

1. **Route ordering** — Static routes must come before parameterized ones
2. **Missing types** — Always specify return type on functions (strict mode enforces)
3. **Guard selection** — Use `ShopifySessionGuard` for embedded frontend calls (JWT Bearer); use `ShopifyHmacGuard` for server-to-server or Shopify webhook calls
4. **Repository queries** — Use `findOne({ where: { ... } })` not `findOne(shopId)`
5. **Circular dependencies** — Reorganize modules if you see "Cannot find module" errors
6. **Missing await** — Async operations without await will silently fail
7. **Env var typos** — `config.getOrThrow()` catches misspelled env names at startup
