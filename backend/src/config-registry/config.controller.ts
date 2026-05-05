import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ShopifySessionGuard } from '../auth/guards/shopify-session.guard';
import { ConfigRegistryService } from './config-registry.service';
import { ConfigNamespaceMeta } from './config-meta.types';
import { SetConfigDto } from './dtos/set-config.dto';

const MASKED = '****';

@Controller('config')
@UseGuards(ShopifySessionGuard)
export class ConfigController {
  constructor(private readonly configRegistryService: ConfigRegistryService) {}

  /**
   * GET /config/schema
   * Returns FE rendering metadata for all registered namespaces.
   * Declared before `:shopId` to prevent "schema" being treated as a shopId.
   */
  @Get('schema')
  getAllMeta(): Record<string, ConfigNamespaceMeta> {
    return this.configRegistryService.getAllMeta();
  }

  /**
   * GET /config/schema/:namespace
   * Returns FE rendering metadata for a single namespace.
   */
  @Get('schema/:namespace')
  getNamespaceMeta(@Param('namespace') namespace: string): ConfigNamespaceMeta {
    const meta = this.configRegistryService.getNamespaceMeta(namespace);
    if (!meta) {
      throw new NotFoundException(`No metadata registered for namespace "${namespace}"`);
    }
    return meta;
  }

  /** GET /config/:shopId — all registered namespaces, merged with DB overrides */
  @Get(':shopId')
  async getAllConfig(@Param('shopId') shopId: string) {
    const config = await this.configRegistryService.getAllConfig(shopId);
    return this.maskAllEncrypted(config);
  }

  /**
   * GET /config/:shopId/value?path=order.export.enabled
   * Must be declared before `:namespace` to prevent "value" being treated as a namespace.
   */
  @Get(':shopId/value')
  async getValue(
    @Param('shopId') shopId: string,
    @Query('path') path: string,
  ) {
    const value = await this.configRegistryService.get(shopId, path);
    if (this.configRegistryService.isEncryptedField(path)) {
      return value ? MASKED : value;
    }
    return value;
  }

  /** GET /config/:shopId/:namespace — merged config for one namespace */
  @Get(':shopId/:namespace')
  async getModuleConfig(
    @Param('shopId') shopId: string,
    @Param('namespace') namespace: string,
  ) {
    const config = await this.configRegistryService.getModuleConfig(shopId, namespace);
    return this.maskEncryptedInNamespace(namespace, config);
  }

  /** POST /config/:shopId — persist a single value { path, value } */
  @Post(':shopId')
  @HttpCode(HttpStatus.OK)
  async setConfig(
    @Param('shopId') shopId: string,
    @Body() dto: SetConfigDto,
  ): Promise<{ saved: boolean }> {
    await this.configRegistryService.set(shopId, dto.path, dto.value);
    return { saved: true };
  }

  // ---------------------------------------------------------------------------

  private maskAllEncrypted(allConfig: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [namespace, nsConfig] of Object.entries(allConfig)) {
      result[namespace] = this.maskEncryptedInNamespace(namespace, nsConfig as Record<string, unknown>);
    }
    return result;
  }

  private maskEncryptedInNamespace(namespace: string, config: Record<string, unknown>): Record<string, unknown> {
    const meta = this.configRegistryService.getNamespaceMeta(namespace);
    if (!meta) return config;
    return this.maskDeep(config, namespace, meta);
  }

  private maskDeep(
    obj: Record<string, unknown>,
    prefix: string,
    meta: ConfigNamespaceMeta,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = `${prefix}.${key}`;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.maskDeep(value as Record<string, unknown>, fullPath, meta);
      } else {
        // Check if this path (relative to namespace) is an encrypted field
        const [, ...rest] = fullPath.split('.');
        const subPath = rest.join('.');
        const fieldMeta = meta.fields[subPath];
        result[key] = fieldMeta?.fieldType === 'encrypted' && value ? MASKED : value;
      }
    }
    return result;
  }
}
