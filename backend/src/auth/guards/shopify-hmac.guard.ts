import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

@Injectable()
export class ShopifyHmacGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { shopDomain?: string; rawBody?: Buffer }>();
    const secret = this.configService.getOrThrow<string>('SHOPIFY_API_SECRET');

    const rawBody: Buffer | undefined = request.rawBody;
    if (!rawBody) {
      throw new UnauthorizedException('Missing raw body');
    }

    // Determine if this is a webhook (X-Shopify-Hmac-SHA256) or shop registration (X-Request-Hmac)
    const shopifyHmacHeader = request.headers['x-shopify-hmac-sha256'] as string | undefined;
    const requestHmacHeader = request.headers['x-request-hmac'] as string | undefined;

    const incomingHmac = shopifyHmacHeader ?? requestHmacHeader;
    if (!incomingHmac) {
      throw new UnauthorizedException('Missing HMAC header');
    }

    // Compute expected HMAC
    const expectedHmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    // Constant-time comparison
    const incoming = Buffer.from(incomingHmac, 'base64');
    const expected = Buffer.from(expectedHmac, 'base64');

    if (incoming.length !== expected.length) {
      throw new UnauthorizedException('Invalid HMAC');
    }

    if (!crypto.timingSafeEqual(incoming, expected)) {
      throw new UnauthorizedException('Invalid HMAC');
    }

    // Attach shopDomain
    if (shopifyHmacHeader) {
      // Webhook: domain from header — NOTE: this header is NOT part of the signed body,
      // so we enforce the *.myshopify.com allowlist as defence-in-depth.
      const shopDomain = request.headers['x-shopify-shop-domain'] as string | undefined;
      if (!shopDomain) {
        throw new UnauthorizedException('Missing X-Shopify-Shop-Domain header');
      }
      if (!SHOP_DOMAIN_RE.test(shopDomain)) {
        throw new UnauthorizedException('Invalid shop domain format');
      }
      request.shopDomain = shopDomain;
    } else {
      // Shop registration: domain from body
      const body = request.body as { shopDomain?: string };
      if (!body.shopDomain) {
        throw new UnauthorizedException('Missing shopDomain in body');
      }
      request.shopDomain = body.shopDomain;
    }

    return true;
  }
}
