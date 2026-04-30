import * as crypto from 'crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ShopifySessionGuard } from './shopify-session.guard';

const TEST_SECRET = 'test-secret';

function makeToken(payload: object, secret: string = TEST_SECRET): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function validPayload(overrides: Partial<Record<string, unknown>> = {}): object {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'https://test-shop.myshopify.com/admin',
    dest: 'https://test-shop.myshopify.com',
    aud: 'test-client-id',
    sub: '42',
    exp: now + 3600,
    nbf: now - 10,
    iat: now - 10,
    jti: 'abc123',
    sid: 'session-id',
    ...overrides,
  };
}

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ShopifySessionGuard', () => {
  let guard: ShopifySessionGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopifySessionGuard,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(TEST_SECRET),
          },
        },
      ],
    }).compile();

    guard = module.get(ShopifySessionGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it('should return true and set shopDomain when token is valid', () => {
    const token = makeToken(validPayload());
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };

    const result = guard.canActivate(makeContext(request));

    expect(result).toBe(true);
    expect(request.shopDomain).toBe('test-shop.myshopify.com');
  });

  it('should throw UnauthorizedException when token is expired', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeToken(validPayload({ exp: now - 100 }));
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };

    expect(() => guard.canActivate(makeContext(request))).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token has invalid signature', () => {
    const token = makeToken(validPayload(), 'wrong-secret');
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };

    expect(() => guard.canActivate(makeContext(request))).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when Authorization header is missing', () => {
    const request: Record<string, unknown> = {
      headers: {},
    };

    expect(() => guard.canActivate(makeContext(request))).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token is malformed (not 3 parts)', () => {
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer notavalidtoken' },
    };

    expect(() => guard.canActivate(makeContext(request))).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when dest claim is missing .myshopify.com', () => {
    const token = makeToken(validPayload({ dest: 'https://example.com' }));
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };

    expect(() => guard.canActivate(makeContext(request))).toThrow(UnauthorizedException);
  });
});
