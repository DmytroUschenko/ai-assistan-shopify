import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { CoreConfig } from './core-config.entity';
import { ConfigNamespaceMeta } from './config-meta.types';
import {
  convertFlatPathsToObject,
  deepMerge,
  getByPath,
} from './utils/config.utils';
import { encrypt, decrypt, isEncryptedValue } from './utils/encryption.utils';

type PlainObject = Record<string, unknown>;

const SECRET_MASK = '****';

@Injectable()
export class ConfigRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ConfigRegistryService.name);
  private readonly registry = new Map<string, PlainObject>();
  private readonly metaRegistry = new Map<string, ConfigNamespaceMeta>();
  private readonly encryptionKey: string | undefined;

  constructor(
    @InjectRepository(CoreConfig)
    private readonly repo: Repository<CoreConfig>,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.get<string>('CONFIG_ENCRYPTION_KEY');
  }

  onModuleInit(): void {
    // Register ai_assistant config with default enabled state
    this.register(
      'ai_assistant',
      { general: { enable: true } },
      {
        moduleLabel: 'AI Assistant',
        fields: {
          'general.enable': {
            groupLabel: 'General',
            keyLabel: 'Enable',
            fieldType: 'toggle',
          },
        },
      },
    );
  }

  /**
   * Registers a module's default configuration under the given namespace.
   * Optionally accepts FE rendering metadata for the namespace.
   * Called at bootstrap time by each module's dynamic provider.
   */
  register(namespace: string, defaultConfig: PlainObject, meta?: ConfigNamespaceMeta): void {
    this.registry.set(namespace, defaultConfig);
    if (meta) {
      this.validateMeta(namespace, defaultConfig, meta);
      this.metaRegistry.set(namespace, meta);
    }
    this.logger.log(`Registered config namespace: ${namespace}`);
  }

  /**
   * Returns the FE rendering metadata for a single namespace, or undefined if
   * no metadata was registered.
   */
  getNamespaceMeta(namespace: string): ConfigNamespaceMeta | undefined {
    const meta = this.metaRegistry.get(namespace);
    if (!meta) return undefined;
    return { ...meta, fields: { ...meta.fields } };
  }

  /**
   * Returns FE rendering metadata for all namespaces that have metadata registered.
   */
  getAllMeta(): Record<string, ConfigNamespaceMeta> {
    const result: Record<string, ConfigNamespaceMeta> = {};
    for (const [ns, meta] of this.metaRegistry.entries()) {
      result[ns] = { ...meta, fields: { ...meta.fields } };
    }
    return result;
  }

  // ---------------------------------------------------------------------------

  /** Warns if meta references paths that don't exist in defaults or if select fields lack options. */
  private validateMeta(namespace: string, defaults: PlainObject, meta: ConfigNamespaceMeta): void {
    for (const [fieldPath, fieldMeta] of Object.entries(meta.fields)) {
      const fullPath = [namespace, ...fieldPath.split('.')];
      const value = getByPath({ [namespace]: defaults }, fullPath);
      if (value === undefined) {
        this.logger.warn(
          `Config meta for "${namespace}": field "${fieldPath}" has no matching default value`,
        );
      }
      if (fieldMeta.fieldType === 'select' && (!fieldMeta.options || fieldMeta.options.length === 0)) {
        this.logger.warn(
          `Config meta for "${namespace}": field "${fieldPath}" has fieldType 'select' but no options`,
        );
      }
      if (fieldMeta.fieldType === 'toggle' && fieldMeta.toggleOptions !== undefined && fieldMeta.toggleOptions.length !== 2) {
        this.logger.warn(
          `Config meta for "${namespace}": field "${fieldPath}" toggleOptions must have exactly 2 entries`,
        );
      }
    }
  }

  /**
   * Returns the merged value at `path` for the given shop.
   * Secret field values are decrypted before returning.
   * Path format: "namespace.group.key" (e.g. "order.export.enabled").
   *
   * NOTE: This returns the real decrypted value. Use this for internal service
   * consumption only — never pass the result directly to an API response.
   * For a masked value safe for API responses use `getMaskedValue()`.
   */
  async get(shopId: string, path: string): Promise<unknown> {
    const [namespace, ...keys] = path.split('.');
    const merged = await this.getMergedNamespace(shopId, namespace);
    const raw = getByPath(merged, [namespace, ...keys]);
    return this.decryptIfNeeded(raw);
  }

  /**
   * Returns the decrypted value of a secret field for internal use by feature services.
   * Returns an empty string if the field has no stored value.
   */
  async getDecrypted(shopId: string, path: string): Promise<string> {
    const value = await this.get(shopId, path);
    if (value === undefined || value === null || value === '') return '';
    return String(value);
  }

  /**
   * Persists a config value for the given shop and path (upsert).
   * Secret fields are encrypted before storage.
   */
  async set(shopId: string, path: string, value: unknown): Promise<void> {
    const storedValue = this.encryptIfSecret(path, value);
    await this.repo.upsert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { shopId, path, value: storedValue as any, updatedAt: new Date() },
      ['shopId', 'path'],
    );
  }

  /**
   * Returns the full merged config object for a single namespace.
   * Secret field values are replaced with `"****"`.
   */
  async getModuleConfig(shopId: string, namespace: string): Promise<PlainObject> {
    const merged = await this.getMergedNamespace(shopId, namespace);
    const raw = (merged[namespace] as PlainObject) ?? {};
    return this.maskSecretFields(namespace, raw);
  }

  /**
   * Returns a map of all registered namespaces with their merged config.
   * Uses a single DB query for all namespaces to avoid N+1 queries.
   * Secret field values are replaced with `"****"`.
   */
  async getAllConfig(shopId: string): Promise<PlainObject> {
    const allRows = await this.repo.find({ where: { shopId } });

    const flat: Record<string, unknown> = {};
    for (const row of allRows) {
      flat[row.path] = row.value;
    }
    const allOverrides = convertFlatPathsToObject(flat);

    const result: PlainObject = {};
    for (const [namespace, defaults] of this.registry.entries()) {
      const nsOverrides = (allOverrides[namespace] as PlainObject | undefined) ?? {};
      const merged = deepMerge(
        { [namespace]: defaults } as PlainObject,
        { [namespace]: nsOverrides } as PlainObject,
      );
      const nsData = merged[namespace] as PlainObject;
      result[namespace] = this.maskSecretFields(namespace, nsData);
    }
    return result;
  }

  // ---------------------------------------------------------------------------

  private async getMergedNamespace(shopId: string, namespace: string): Promise<PlainObject> {
    const defaults = this.registry.get(namespace) ?? {};
    const overrides = await this.loadDbOverrides(shopId, namespace);
    return deepMerge({ [namespace]: defaults } as PlainObject, overrides);
  }

  private async loadDbOverrides(shopId: string, namespace: string): Promise<PlainObject> {
    const rows = await this.repo.find({
      where: { shopId, path: Like(`${namespace}.%`) },
    });

    const flat: Record<string, unknown> = {};
    for (const row of rows) {
      flat[row.path] = row.value;
    }

    return convertFlatPathsToObject(flat);
  }

  /**
   * Encrypts a value before storage if the path maps to a `secret` field.
   * Returns the original value unchanged for non-secret fields.
   */
  private encryptIfSecret(path: string, value: unknown): unknown {
    const [namespace, ...keys] = path.split('.');
    const fieldPath = keys.join('.');
    const meta = this.metaRegistry.get(namespace);
    if (!meta) return value;
    const fieldMeta = meta.fields[fieldPath];
    if (!fieldMeta || fieldMeta.fieldType !== 'secret') return value;
    if (typeof value !== 'string' || value === '') return value;
    if (!this.encryptionKey) {
      this.logger.warn(`CONFIG_ENCRYPTION_KEY is not set — secret field "${path}" will be stored in plaintext`);
      return value;
    }
    return encrypt(value, this.encryptionKey);
  }

  /**
   * Decrypts a value if it is an encrypted string, otherwise returns it as-is.
   */
  private decryptIfNeeded(value: unknown): unknown {
    if (!isEncryptedValue(value)) return value;
    if (!this.encryptionKey) {
      this.logger.warn('CONFIG_ENCRYPTION_KEY is not set — cannot decrypt secret value');
      return '';
    }
    try {
      return decrypt(value, this.encryptionKey);
    } catch {
      this.logger.error('Failed to decrypt secret config value');
      return '';
    }
  }

  /**
   * Replaces all secret field values in a namespace config object with `"****"`.
   * Returns a shallow-cloned object; does not mutate the input.
   */
  private maskSecretFields(namespace: string, data: PlainObject): PlainObject {
    const meta = this.metaRegistry.get(namespace);
    if (!meta) return data;

    const secretPaths = Object.entries(meta.fields)
      .filter(([, f]) => f.fieldType === 'secret')
      .map(([p]) => p.split('.'));

    if (secretPaths.length === 0) return data;

    // Deep clone then overwrite secret leaves
    const cloned = JSON.parse(JSON.stringify(data)) as PlainObject;
    for (const pathArray of secretPaths) {
      let node: PlainObject = cloned;
      for (let i = 0; i < pathArray.length - 1; i++) {
        const key = pathArray[i];
        if (typeof node[key] !== 'object' || node[key] === null) break;
        node = node[key] as PlainObject;
      }
      const leaf = pathArray[pathArray.length - 1];
      if (leaf in node) {
        node[leaf] = SECRET_MASK;
      }
    }
    return cloned;
  }
}
