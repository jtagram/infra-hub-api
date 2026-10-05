import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { createPublicKey, JsonWebKey } from 'crypto';
import { Logger } from 'nestjs-pino';

/** One key of iam-api's `GET /.well-known/jwks.json` response. */
type JwksKey = JsonWebKey & { kid?: string };

/** Shape of iam-api's `GET /.well-known/jwks.json` response. */
interface JwksResponse {
  keys: JwksKey[];
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const UNKNOWN_KEY_REFRESH_COOLDOWN_MS = 30 * 1000;

/**
 * Keeps iam-api's RS256 public keys in memory, indexed by `kid`, fetched over
 * HTTP from its JWKS endpoint instead of a static env var. A failed fetch on
 * startup fails the whole application boot (same criterion as a missing
 * required env var); a failed periodic refresh only logs and keeps using the
 * last known-good keys.
 *
 * A token signed with a `kid` we do not know yet (e.g. right after iam-api
 * rotated its key) triggers one extra fetch, rate-limited so that tokens with
 * made-up `kid`s cannot make this service hammer iam-api.
 */
@Injectable()
export class JwtPublicKeyService implements OnModuleInit {
  private publicKeysByKid = new Map<string, string>();
  private lastFetchAtMs = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadPublicKeys();
  }

  /** PEM public key that matches the `kid` of a token, or `undefined` if none does. */
  async getPublicKey(kid: string): Promise<string | undefined> {
    const knownKey = this.publicKeysByKid.get(kid);
    if (knownKey) {
      return knownKey;
    }

    if (Date.now() - this.lastFetchAtMs >= UNKNOWN_KEY_REFRESH_COOLDOWN_MS) {
      await this.refreshPublicKeys();
    }
    return this.publicKeysByKid.get(kid);
  }

  @Interval(REFRESH_INTERVAL_MS)
  async refreshPublicKeys(): Promise<void> {
    try {
      await this.loadPublicKeys();
    } catch (error) {
      this.logger.error({
        err: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        msg: 'Failed to refresh JWT public keys from iam-api; keeping previous keys',
      });
    }
  }

  private get iamApiUrl(): string {
    return this.configService.get<string>('IAM_API_URL')!;
  }

  private async loadPublicKeys(): Promise<void> {
    this.lastFetchAtMs = Date.now();
    const response = await fetch(`${this.iamApiUrl}/.well-known/jwks.json`);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch JWT public keys from iam-api: HTTP ${response.status}`,
      );
    }

    const body = (await response.json()) as Partial<JwksResponse>;
    const publicKeysByKid = new Map<string, string>();

    for (const jwk of body?.keys ?? []) {
      if (typeof jwk.kid === 'string' && jwk.kid.length > 0) {
        publicKeysByKid.set(jwk.kid, toPem(jwk));
      }
    }

    if (publicKeysByKid.size === 0) {
      throw new Error(
        'Failed to fetch JWT public keys from iam-api: no usable keys with a "kid" in the JWKS response',
      );
    }

    this.publicKeysByKid = publicKeysByKid;
  }
}

function toPem(jwk: JwksKey): string {
  return createPublicKey({ key: jwk, format: 'jwk' })
    .export({ type: 'spki', format: 'pem' })
    .toString();
}
