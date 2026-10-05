import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from '../jwt/authenticated-user';
import { JwtPublicKeyService } from '../jwt/jwt-public-key.service';
import { IS_PUBLIC_KEY } from './public.decorator';

const MISSING_TOKEN_MESSAGE = 'Missing or malformed bearer token';
const INVALID_TOKEN_MESSAGE = 'Invalid or expired token';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly jwtPublicKeyService: JwtPublicKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException(MISSING_TOKEN_MESSAGE);
    }

    const publicKey = await this.findPublicKey(token);
    if (!publicKey) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }

    const payload = await verifyToken(this.jwtService, token, publicKey);
    if (!payload) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }

    (request as Request & { user: AuthenticatedUser }).user = payload;
    return true;
  }

  private async findPublicKey(token: string): Promise<string | undefined> {
    const decoded = this.jwtService.decode<{
      header?: { kid?: string };
    } | null>(token, { complete: true });
    const kid = decoded?.header?.kid;
    return kid ? this.jwtPublicKeyService.getPublicKey(kid) : undefined;
  }
}

function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header) {
    return undefined;
  }

  const [type, token] = header.split(' ');
  return type === 'Bearer' && token ? token : undefined;
}

async function verifyToken(
  jwtService: JwtService,
  token: string,
  publicKey: string,
): Promise<AuthenticatedUser | null> {
  try {
    return await jwtService.verifyAsync<AuthenticatedUser>(token, {
      publicKey,
      algorithms: ['RS256'],
    });
  } catch (error) {
    console.error('Failed to verify JWT', error);
    return null;
  }
}
