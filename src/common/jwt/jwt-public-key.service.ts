import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';

/** Shape of iam-api's `GET /auth/public-key` response. */
interface PublicKeyResponse {
  publicKey: string;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Keeps iam-api's RS256 public key in memory, fetched over HTTP instead of a
 * static env var. A failed fetch on startup fails the whole application boot
 * (same criterion as a missing required env var); a failed periodic refresh
 * only logs and keeps using the last known-good key.
 */
@Injectable()
export class JwtPublicKeyService implements OnModuleInit {
  private currentPublicKey!: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.currentPublicKey = await this.fetchPublicKey();
  }

  getCurrentPublicKey(): string {
    return this.currentPublicKey;
  }

  @Interval(REFRESH_INTERVAL_MS)
  async refreshPublicKey(): Promise<void> {
    try {
      this.currentPublicKey = await this.fetchPublicKey();
    } catch (error) {
      this.logger.error({
        err: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        msg: 'Failed to refresh JWT public key from iam-api; keeping previous key',
      });
    }
  }

  private get iamApiUrl(): string {
    return this.configService.get<string>('IAM_API_URL')!;
  }

  private async fetchPublicKey(): Promise<string> {
    const response = await fetch(`${this.iamApiUrl}/auth/public-key`);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch JWT public key from iam-api: HTTP ${response.status}`,
      );
    }

    const body = (await response.json()) as Partial<PublicKeyResponse>;
    const publicKey = body?.publicKey;

    if (typeof publicKey !== 'string' || publicKey.trim().length === 0) {
      throw new Error(
        'Failed to fetch JWT public key from iam-api: missing or empty "publicKey" field',
      );
    }

    return publicKey;
  }
}
