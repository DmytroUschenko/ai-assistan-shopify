import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface HmacRequest {
  body: Record<string, unknown>;
}

interface SessionTokenRequest {
  shopDomain: string;
  shopId?: string;
}

/**
 * DEV-ONLY controller — registered only when NODE_ENV !== 'production'.
 *
 * Provides two helpers for Postman local testing:
 *
 * POST /dev/sign/hmac
 *   Body: { "body": { ...the JSON you want to send to the real endpoint } }
 *   Returns: { "hmac": "<base64>", "bodyJson": "<stringified body>" }
 *   Usage: copy `hmac` → X-Request-Hmac header on POST /shops
 *
 * POST /dev/sign/session-token
 *   Body: { "shopDomain": "my-store.myshopify.com", "shopId": "optional-subject" }
 *   Returns: { "token": "<JWT>", "shopDomain": "..." }
 *   Usage: copy `token` → Authorization: Bearer <token> on /config/* endpoints
 */
@Controller('dev')
export class DevToolsController {
  constructor(private readonly configService: ConfigService) {}

  @Post('sign/hmac')
  @HttpCode(HttpStatus.OK)
  signHmac(@Body() dto: HmacRequest): { hmac: string; bodyJson: string } {
    const secret = this.configService.getOrThrow<string>('SHOPIFY_API_SECRET');
    const bodyJson = JSON.stringify(dto.body);
    const hmac = crypto.createHmac('sha256', secret).update(bodyJson).digest('base64');
    return { hmac, bodyJson };
  }

  @Post('sign/session-token')
  @HttpCode(HttpStatus.OK)
  signSessionToken(@Body() dto: SessionTokenRequest): { token: string; shopDomain: string } {
    const secret = this.configService.getOrThrow<string>('SHOPIFY_API_SECRET');
    const shopDomain = dto.shopDomain;
    const shopId = dto.shopId ?? 'dev-user';

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: `https://${shopDomain}/admin`,
        dest: `https://${shopDomain}`,
        aud: this.configService.getOrThrow<string>('SHOPIFY_API_KEY'),
        sub: shopId,
        exp: now + 3600,
        nbf: now,
        iat: now,
        jti: crypto.randomUUID(),
        sid: crypto.randomBytes(16).toString('hex'),
      }),
    ).toString('base64url');

    const signingInput = `${header}.${payload}`;
    const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
    const token = `${signingInput}.${signature}`;

    return { token, shopDomain };
  }
}
