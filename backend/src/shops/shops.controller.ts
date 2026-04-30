import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ShopifyHmacGuard } from '../auth/guards/shopify-hmac.guard';
import { RegisterShopDto } from './dtos/register-shop.dto';
import { ShopsService } from './shops.service';

@Controller('shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ShopifyHmacGuard)
  async registerShop(@Body() dto: RegisterShopDto): Promise<{ registered: boolean }> {
    await this.shopsService.registerShop(dto.shopDomain, dto.accessToken, dto.scope);
    return { registered: true };
  }
}
