import { Module } from '@nestjs/common';
import { ShopifyHmacGuard } from './guards/shopify-hmac.guard';
import { ShopifySessionGuard } from './guards/shopify-session.guard';

@Module({
  providers: [ShopifyHmacGuard, ShopifySessionGuard],
  exports: [ShopifyHmacGuard, ShopifySessionGuard],
})
export class AuthModule {}
