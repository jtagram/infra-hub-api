import { generateKeyPairSync } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../../src/common/roles/role.enum';

export const TEST_APPLICATION_NAME = 'infra-hub-api-test';
export const TEST_KEY_ID = 'e2e-test-key';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

/** Stand-in for JwtPublicKeyService: serves the test public key, no HTTP. */
export const publicKeyServiceStub = {
  getPublicKey: async (kid: string): Promise<string | undefined> =>
    kid === TEST_KEY_ID ? publicKey : undefined,
};

export interface TestUser {
  email: string;
  roles: (Role | string)[];
  applicationName?: string;
}

/** Signs a real RS256 token with the same claim shape iam-api issues. */
export function bearerTokenFor(user: TestUser): string {
  const claims = {
    email: user.email,
    apps: {
      application: {
        id: 1,
        name: user.applicationName ?? TEST_APPLICATION_NAME,
        description: 'Infra hub (e2e)',
        roles: user.roles.map((name, index) => ({
          id: index + 1,
          name,
          description: name,
        })),
      },
    },
  };

  return new JwtService().sign(claims, {
    privateKey,
    algorithm: 'RS256',
    keyid: TEST_KEY_ID,
    expiresIn: '5m',
  });
}

/**
 * Signs a real token with arbitrary claims, for malformed-but-verifiable
 * payloads (e.g. no `apps` claim) that bearerTokenFor cannot produce.
 */
export function bearerTokenWithClaims(claims: Record<string, unknown>): string {
  return new JwtService().sign(claims, {
    privateKey,
    algorithm: 'RS256',
    keyid: TEST_KEY_ID,
    expiresIn: '5m',
  });
}

export function authorizationHeaderForClaims(
  claims: Record<string, unknown>,
): string {
  return `Bearer ${bearerTokenWithClaims(claims)}`;
}

export function authorizationHeaderFor(user: TestUser): string {
  return `Bearer ${bearerTokenFor(user)}`;
}

/** Public key served by the JWKS stub (PEM). */
export const TEST_PUBLIC_KEY_PEM = publicKey;

const FOREIGN_KEY_PAIR = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function adminClaims(): Record<string, unknown> {
  return {
    email: 'admin@example.com',
    apps: {
      application: {
        id: 1,
        name: TEST_APPLICATION_NAME,
        description: 'Infra hub (e2e)',
        roles: [{ id: 1, name: Role.ADMIN, description: Role.ADMIN }],
      },
    },
  };
}

/** Well-formed ADMIN token whose `exp` is already in the past. */
export function expiredAdminAuthorizationHeader(): string {
  const token = new JwtService().sign(
    { ...adminClaims(), exp: Math.floor(Date.now() / 1000) - 60 },
    { privateKey, algorithm: 'RS256', keyid: TEST_KEY_ID },
  );
  return `Bearer ${token}`;
}

/** ADMIN token announcing the trusted `kid` but signed with another RSA key. */
export function wrongKeyAdminAuthorizationHeader(): string {
  const token = new JwtService().sign(adminClaims(), {
    privateKey: FOREIGN_KEY_PAIR.privateKey,
    algorithm: 'RS256',
    keyid: TEST_KEY_ID,
    expiresIn: '5m',
  });
  return `Bearer ${token}`;
}

/** ADMIN token signed with the trusted key but announcing an unknown `kid`. */
export function unknownKidAdminAuthorizationHeader(): string {
  const token = new JwtService().sign(adminClaims(), {
    privateKey,
    algorithm: 'RS256',
    keyid: 'rotated-away-key',
    expiresIn: '5m',
  });
  return `Bearer ${token}`;
}

/** Algorithm-confusion attempt: HS256 token keyed with the PUBLIC key PEM. */
export function hs256ConfusionAdminAuthorizationHeader(): string {
  const token = new JwtService().sign(adminClaims(), {
    secret: publicKey,
    algorithm: 'HS256',
    keyid: TEST_KEY_ID,
    expiresIn: '5m',
  });
  return `Bearer ${token}`;
}

export const ADMIN_AUTHORIZATION = authorizationHeaderFor({
  email: 'admin@example.com',
  roles: [Role.ADMIN],
});
