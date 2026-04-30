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
    return this.configRegistryService.getAllConfig(shopId);
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
    return this.configRegistryService.get(shopId, path);
  }

  /** GET /config/:shopId/:namespace — merged config for one namespace */
  @Get(':shopId/:namespace')
  async getModuleConfig(
    @Param('shopId') shopId: string,
    @Param('namespace') namespace: string,
  ) {
    return this.configRegistryService.getModuleConfig(shopId, namespace);
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
}
