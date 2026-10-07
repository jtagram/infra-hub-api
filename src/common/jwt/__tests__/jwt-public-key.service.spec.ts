import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, JsonWebKey } from 'crypto';
import { Logger } from 'nestjs-pino';
import { JwtPublicKeyService } from '../jwt-public-key.service';

// @nestjs/config is ESM-only and Jest runs as CommonJS. The service is built
// by hand below, so only the class token needs to exist.
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));
// @nestjs/schedule is ESM-only too; the @Interval scheduling is not under test.
jest.mock('@nestjs/schedule', () => ({ Interval: () => () => undefined }));

const IAM_API_URL = 'http://iam-api:3002';
const COOLDOWN_MS = 30 * 1000;

const buildJwk = (kid?: string): JsonWebKey & { kid?: string } => {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as JsonWebKey;
  return kid === undefined ? jwk : { ...jwk, kid };
};

const jwksResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as unknown as Response;

describe('JwtPublicKeyService', () => {
  let fetchMock: jest.Mock<
    (url: string, init?: RequestInit) => Promise<Response>
  >;
  let logger: { error: jest.Mock };
  let configService: { get: jest.Mock };
  let service: JwtPublicKeyService;
  let now: number;

  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    fetchMock =
      jest.fn<(url: string, init?: RequestInit) => Promise<Response>>();
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as never);
    logger = { error: jest.fn() };
    configService = { get: jest.fn().mockReturnValue(IAM_API_URL) };
    service = new JwtPublicKeyService(
      configService as unknown as ConfigService,
      logger as unknown as Logger,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('fetches the JWKS from IAM_API_URL/.well-known/jwks.json', async () => {
      fetchMock.mockResolvedValue(jwksResponse({ keys: [buildJwk('k1')] }));

      await service.onModuleInit();

      expect(configService.get).toHaveBeenCalledWith('IAM_API_URL');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(
        'http://iam-api:3002/.well-known/jwks.json',
      );
    });

    it('stores every key with a kid as a PEM public key', async () => {
      fetchMock.mockResolvedValue(
        jwksResponse({ keys: [buildJwk('k1'), buildJwk('k2')] }),
      );

      await service.onModuleInit();

      await expect(service.getPublicKey('k1')).resolves.toMatch(
        /^-----BEGIN PUBLIC KEY-----/,
      );
      await expect(service.getPublicKey('k2')).resolves.toMatch(
        /-----END PUBLIC KEY-----\n$/,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('ignores keys without a kid and keeps the ones that have it', async () => {
      fetchMock.mockResolvedValue(
        jwksResponse({ keys: [buildJwk(), buildJwk(''), buildJwk('k1')] }),
      );

      await service.onModuleInit();

      await expect(service.getPublicKey('k1')).resolves.toBeDefined();
    });

    it('fails the boot when iam-api answers with a non 2xx status', async () => {
      fetchMock.mockResolvedValue(jwksResponse({}, false, 503));

      await expect(service.onModuleInit()).rejects.toThrow(
        'Failed to fetch JWT public keys from iam-api: HTTP 503',
      );
    });

    it('fails the boot when iam-api is unreachable', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      await expect(service.onModuleInit()).rejects.toThrow('fetch failed');
    });

    it('fails the boot when the JWKS has no keys', async () => {
      fetchMock.mockResolvedValue(jwksResponse({ keys: [] }));

      await expect(service.onModuleInit()).rejects.toThrow(
        /no usable keys with a "kid"/,
      );
    });

    it('fails the boot when the JWKS only has keys without kid', async () => {
      fetchMock.mockResolvedValue(jwksResponse({ keys: [buildJwk()] }));

      await expect(service.onModuleInit()).rejects.toThrow(
        /no usable keys with a "kid"/,
      );
    });

    it('fails the boot when the response body has no "keys" property', async () => {
      fetchMock.mockResolvedValue(jwksResponse({}));

      await expect(service.onModuleInit()).rejects.toThrow(
        /no usable keys with a "kid"/,
      );
    });

    it('fails the boot when the response body is null', async () => {
      fetchMock.mockResolvedValue(jwksResponse(null));

      await expect(service.onModuleInit()).rejects.toThrow(
        /no usable keys with a "kid"/,
      );
    });

    it('fails the boot when a key is not a valid JWK', async () => {
      fetchMock.mockResolvedValue(
        jwksResponse({ keys: [{ kid: 'broken', kty: 'oct', k: 'c2VjcmV0' }] }),
      );

      await expect(service.onModuleInit()).rejects.toThrow();
    });

    it('fails the boot when the body is not valid JSON', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      } as unknown as Response);

      await expect(service.onModuleInit()).rejects.toThrow(SyntaxError);
    });
  });

  describe('getPublicKey', () => {
    it('returns a known key without fetching again', async () => {
      fetchMock.mockResolvedValue(jwksResponse({ keys: [buildJwk('k1')] }));
      await service.onModuleInit();
      fetchMock.mockClear();
      now += 10 * COOLDOWN_MS;

      await expect(service.getPublicKey('k1')).resolves.toBeDefined();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshes once and finds a key rotated in after the cooldown', async () => {
      fetchMock.mockResolvedValueOnce(
        jwksResponse({ keys: [buildJwk('old')] }),
      );
      await service.onModuleInit();
      fetchMock.mockResolvedValueOnce(
        jwksResponse({ keys: [buildJwk('new')] }),
      );
      now += COOLDOWN_MS;

      await expect(service.getPublicKey('new')).resolves.toMatch(
        /BEGIN PUBLIC KEY/,
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns undefined for an unknown kid after refreshing', async () => {
      fetchMock.mockResolvedValue(jwksResponse({ keys: [buildJwk('k1')] }));
      await service.onModuleInit();
      now += COOLDOWN_MS;

      await expect(service.getPublicKey('made-up')).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not hit iam-api again for unknown kids within the cooldown', async () => {
      fetchMock.mockResolvedValue(jwksResponse({ keys: [buildJwk('k1')] }));
      await service.onModuleInit();
      now += COOLDOWN_MS - 1;

      await expect(service.getPublicKey('made-up')).resolves.toBeUndefined();
      await expect(service.getPublicKey('another')).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('restarts the cooldown after an unknown-kid refresh', async () => {
      fetchMock.mockResolvedValue(jwksResponse({ keys: [buildJwk('k1')] }));
      await service.onModuleInit();
      now += COOLDOWN_MS;
      await service.getPublicKey('made-up');
      now += COOLDOWN_MS - 1;

      await service.getPublicKey('made-up');

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('keeps serving the previous keys when the unknown-kid refresh fails', async () => {
      fetchMock.mockResolvedValueOnce(jwksResponse({ keys: [buildJwk('k1')] }));
      await service.onModuleInit();
      fetchMock.mockRejectedValueOnce(new Error('iam down'));
      now += COOLDOWN_MS;

      await expect(service.getPublicKey('made-up')).resolves.toBeUndefined();
      await expect(service.getPublicKey('k1')).resolves.toBeDefined();
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshPublicKeys', () => {
    it('replaces the previous keys with the new ones (rotated-out keys disappear)', async () => {
      fetchMock.mockResolvedValueOnce(
        jwksResponse({ keys: [buildJwk('old')] }),
      );
      await service.onModuleInit();
      fetchMock.mockResolvedValueOnce(
        jwksResponse({ keys: [buildJwk('new')] }),
      );

      await service.refreshPublicKeys();
      now += 0;

      await expect(service.getPublicKey('new')).resolves.toBeDefined();
      await expect(service.getPublicKey('old')).resolves.toBeUndefined();
    });

    it('logs the error and keeps the last known-good keys when the fetch fails', async () => {
      fetchMock.mockResolvedValueOnce(jwksResponse({ keys: [buildJwk('k1')] }));
      await service.onModuleInit();
      fetchMock.mockRejectedValueOnce(new Error('network down'));

      await expect(service.refreshPublicKeys()).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({
        err: { message: 'network down', stack: expect.any(String) },
        msg: 'Failed to refresh JWT public keys from iam-api; keeping previous keys',
      });
      await expect(service.getPublicKey('k1')).resolves.toBeDefined();
    });

    it('logs an HTTP failure and keeps the previous keys', async () => {
      fetchMock.mockResolvedValueOnce(jwksResponse({ keys: [buildJwk('k1')] }));
      await service.onModuleInit();
      fetchMock.mockResolvedValueOnce(jwksResponse({}, false, 500));

      await service.refreshPublicKeys();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({
            message: 'Failed to fetch JWT public keys from iam-api: HTTP 500',
          }),
        }),
      );
      await expect(service.getPublicKey('k1')).resolves.toBeDefined();
    });

    it('keeps the previous keys when the new JWKS is empty', async () => {
      fetchMock.mockResolvedValueOnce(jwksResponse({ keys: [buildJwk('k1')] }));
      await service.onModuleInit();
      fetchMock.mockResolvedValueOnce(jwksResponse({ keys: [] }));

      await service.refreshPublicKeys();

      await expect(service.getPublicKey('k1')).resolves.toBeDefined();
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('logs a non-Error rejection as a string', async () => {
      fetchMock.mockRejectedValueOnce('plain failure');

      await service.refreshPublicKeys();

      expect(logger.error).toHaveBeenCalledWith({
        err: { message: 'plain failure', stack: undefined },
        msg: 'Failed to refresh JWT public keys from iam-api; keeping previous keys',
      });
    });
  });
});
