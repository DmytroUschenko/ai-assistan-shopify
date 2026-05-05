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
import { encrypt, decrypt } from './utils/encryption.utils';

type PlainObject = Record<string, unknown>;

@Injectable()
export class ConfigRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ConfigRegistryService.name);
  private readonly registry = new Map<string, PlainObject>();
  private readonly metaRegistry = new Map<string, ConfigNamespaceMeta>();

  constructor(
    @InjectRepository(CoreConfig)
    private readonly repo: Repository<CoreConfig>,
    private readonly configService: ConfigService,
  ) {}

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
    }
  }

  /**
   * Returns the merged value at `path` for the given shop.
   * Path format: "namespace.group.key" (e.g. "order.export.enabled").
   */
  async get(shopId: string, path: string): Promise<unknown> {
    const [namespace, ...keys] = path.split('.');
    const merged = await this.getMergedNamespace(shopId, namespace);
    return getByPath(merged, [namespace, ...keys]);
  }

  /**
   * Persists a config value for the given shop and path (upsert).
   * Encrypts the value if the field metadata declares fieldType 'encrypted'.
   */
  async set(shopId: string, path: string, value: unknown): Promise<void> {
    let storedValue = value;
    if (this.isEncryptedField(path)) {
      const key = this.configService.getOrThrow<string>('ENCRYPTION_KEY');
      storedValue = encrypt(String(value), key);
    }
    await this.repo.upsert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { shopId, path, value: storedValue as any, updatedAt: new Date() },
      ['shopId', 'path'],
    );
  }

  /**
   * Returns the full merged config object for a single namespace.
   */
  async getModuleConfig(shopId: string, namespace: string): Promise<PlainObject> {
    const merged = await this.getMergedNamespace(shopId, namespace);
    return (merged[namespace] as PlainObject) ?? {};
  }

  /**
   * Returns a map of all registered namespaces with their merged config.
   */
  async getAllConfig(shopId: string): Promise<PlainObject> {
    const result: PlainObject = {};
    for (const namespace of this.registry.keys()) {
      result[namespace] = await this.getModuleConfig(shopId, namespace);
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
      if (this.isEncryptedField(row.path) && typeof row.value === 'string' && row.value.includes(':')) {
        try {
          const key = this.configService.getOrThrow<string>('ENCRYPTION_KEY');
          flat[row.path] = decrypt(row.value, key);
        } catch {
          this.logger.warn(`Failed to decrypt value for path "${row.path}" — skipping`);
          flat[row.path] = '';
        }
      } else {
        flat[row.path] = row.value;
      }
    }

    return convertFlatPathsToObject(flat);
  }

  /** Returns true if the field at the given full dot-path has fieldType 'encrypted'. */
  isEncryptedField(path: string): boolean {
    const [namespace, ...rest] = path.split('.');
    const subPath = rest.join('.');
    const meta = this.metaRegistry.get(namespace);
    return meta?.fields[subPath]?.fieldType === 'encrypted';
  }
}
