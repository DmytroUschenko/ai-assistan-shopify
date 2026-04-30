import * as crypto from 'crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ShopifyHmacGuard } from './shopify-hmac.guard';

const TEST_SECRET = 'test-secret';

function makeHmac(rawBody: Buffer): string {
  return crypto.createHmac('sha256', TEST_SECRET).update(rawBody).digest('base64');
}

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ShopifyHmacGuard', () => {
  let guard: ShopifyHmacGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifyHmacGuard,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(TEST_SECRET),
          },
        },
      ],
    }).compile();

    guard = module.get(ShopifyHmacGuard);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Webhook HMAC (x-shopify-hmac-sha256)', () => {
    it('should return true and set shopDomain when HMAC is valid', () => {
      const rawBody = Buffer.from(JSON.stringify({ id: 1 }));
      const hmac = makeHmac(rawBody);
      const request = {
        rawBody,
        headers: {
          'x-shopify-hmac-sha256': hmac,
          'x-shopify-shop-domain': 'test-shop.myshopify.com',
        },
        body: {},
      };

      const result = guard.canActivate(makeContext(request));

      expect(result).toBe(true);
      expect(request).toHaveProperty('shopDomain', 'test-shop.myshopify.com');
    });

    it('should throw UnauthorizedException when webhook HMAC is invalid', () => {
      const rawBody = Buffer.from(JSON.stringify({ id: 1 }));
      const request = {
        rawBody,
        headers: {
          'x-shopify-hmac-sha256': 'aW52YWxpZA==', // "invalid" in base64
          'x-shopify-shop-domain': 'test-shop.myshopify.com',
        },
        body: {},
      };

      expect(() => guard.canActivate(makeContext(request))).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when x-shopify-shop-domain header is missing', () => {
      const rawBody = Buffer.from(JSON.stringify({ id: 1 }));
      const hmac = makeHmac(rawBody);
      const request = {
        rawBody,
        headers: {
          'x-shopify-hmac-sha256': hmac,
          // x-shopify-shop-domain intentionally omitted
        },
        body: {},
      };

      expect(() => guard.canActivate(makeContext(request))).toThrow(UnauthorizedException);
    });
  });

  describe('Shop registration HMAC (x-request-hmac)', () => {
    it('should return true and set shopDomain from body when HMAC is valid', () => {
      const rawBody = Buffer.from(JSON.stringify({ shopDomain: 'test-shop.myshopify.com', accessToken: 'tok', scope: 's' }));
      const hmac = makeHmac(rawBody);
      const request = {
        rawBody,
        headers: {
          'x-request-hmac': hmac,
        },
        body: { shopDomain: 'test-shop.myshopify.com', accessToken: 'tok', scope: 's' },
      };

      const result = guard.canActivate(makeContext(request));

      expect(result).toBe(true);
      expect(request).toHaveProperty('shopDomain', 'test-shop.myshopify.com');
    });

    it('should throw UnauthorizedException when shop registration HMAC is invalid', () => {
      const rawBody = Buffer.from(JSON.stringify({ shopDomain: 'test-shop.myshopify.com' }));
      const request = {
        rawBody,
        headers: {
          'x-request-hmac': 'd3JvbmcK', // wrong signature
        },
        body: { shopDomain: 'test-shop.myshopify.com' },
      };

      expect(() => guard.canActivate(makeContext(request))).toThrow(UnauthorizedException);
    });
  });

  describe('Missing / malformed inputs', () => {
    it('should throw UnauthorizedException when no HMAC header is present', () => {
      const rawBody = Buffer.from('{}');
      const request = {
        rawBody,
        headers: {},
        body: {},
      };

      expect(() => guard.canActivate(makeContext(request))).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when rawBody is undefined', () => {
      const request = {
        rawBody: undefined,
        headers: {
          'x-shopify-hmac-sha256': 'anything',
          'x-shopify-shop-domain': 'test-shop.myshopify.com',
        },
        body: {},
      };

      expect(() => guard.canActivate(makeContext(request))).toThrow(UnauthorizedException);
    });
  });
});
