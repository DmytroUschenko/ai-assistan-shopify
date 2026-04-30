import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

interface SessionTokenPayload {
  iss: string;
  dest: string;
  aud: string;
  sub: string;
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sid: string;
}

@Injectable()
export class ShopifySessionGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { shopDomain?: string }>();
    const secret = this.configService.getOrThrow<string>('SHOPIFY_API_SECRET');

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid token format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify HS256 signature
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url');

    const incomingBuf = Buffer.from(signatureB64, 'base64url');
    const expectedBuf = Buffer.from(expectedSig, 'base64url');

    if (incomingBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(incomingBuf, expectedBuf)) {
      throw new UnauthorizedException('Invalid token signature');
    }

    // Decode payload
    let payload: SessionTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new UnauthorizedException('Token expired');
    }
    if (payload.nbf && payload.nbf > now) {
      throw new UnauthorizedException('Token not yet valid');
    }

    // Validate dest claim
    if (!payload.dest || !payload.dest.includes('.myshopify.com')) {
      throw new UnauthorizedException('Invalid dest claim');
    }

    // Extract shop domain from dest
    const destUrl = new URL(payload.dest);
    request.shopDomain = destUrl.hostname;

    return true;
  }
}
