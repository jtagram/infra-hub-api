import { describe, expect, it } from '@jest/globals';
import { EnvironmentVariables, validate } from '../env.validation';

const validEnv = (): Record<string, unknown> => ({
  SERVER_SSH_HOST: 'pcbox.example.com',
  SERVER_SSH_USER: 'deploy',
  SERVER_SSH_PRIVATE_KEY: '-----BEGIN OPENSSH PRIVATE KEY-----',
  PORT: '3003',
  LOG_LEVEL: 'info',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'infra',
  DB_PASSWORD: 'secret',
  DB_NAME: 'infra_hub',
  IAM_API_URL: 'http://iam-api:3002',
  INFRA_HUB_API_APPLICATION_NAME: 'infra-hub-api',
});

describe('validate (environment variables)', () => {
  it('returns an EnvironmentVariables instance for a complete configuration', () => {
    const result = validate(validEnv());

    expect(result).toBeInstanceOf(EnvironmentVariables);
    expect(result.SERVER_SSH_HOST).toBe('pcbox.example.com');
    expect(result.PORT).toBe('3003');
  });

  it('accepts every pino log level', () => {
    for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal']) {
      expect(() => validate({ ...validEnv(), LOG_LEVEL: level })).not.toThrow();
    }
  });

  it('keeps unrelated variables out of the validation', () => {
    expect(() => validate({ ...validEnv(), PATH: '/usr/bin' })).not.toThrow();
  });

  it('rejects a missing SERVER_SSH_HOST', () => {
    const { SERVER_SSH_HOST, ...env } = validEnv();

    expect(() => validate(env)).toThrow(
      'Missing required environment variable(s): SERVER_SSH_HOST',
    );
  });

  it('rejects a missing SERVER_SSH_USER', () => {
    const { SERVER_SSH_USER, ...env } = validEnv();

    expect(() => validate(env)).toThrow(/SERVER_SSH_USER/);
  });

  it('rejects an empty SERVER_SSH_PRIVATE_KEY', () => {
    expect(() =>
      validate({ ...validEnv(), SERVER_SSH_PRIVATE_KEY: '' }),
    ).toThrow(/SERVER_SSH_PRIVATE_KEY/);
  });

  it('rejects a non numeric PORT', () => {
    expect(() => validate({ ...validEnv(), PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects a numeric PORT (not a string)', () => {
    expect(() => validate({ ...validEnv(), PORT: 3003 })).toThrow(/PORT/);
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => validate({ ...validEnv(), LOG_LEVEL: 'verbose' })).toThrow(
      /LOG_LEVEL/,
    );
  });

  it('rejects a non numeric DB_PORT', () => {
    expect(() => validate({ ...validEnv(), DB_PORT: 'five' })).toThrow(
      /DB_PORT/,
    );
  });

  it('rejects a missing DB_HOST, DB_USERNAME, DB_PASSWORD and DB_NAME', () => {
    const { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME, ...env } = validEnv();

    expect(() => validate(env)).toThrow(
      /DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME/,
    );
  });

  it('rejects a missing IAM_API_URL', () => {
    const { IAM_API_URL, ...env } = validEnv();

    expect(() => validate(env)).toThrow(/IAM_API_URL/);
  });

  it('rejects a missing INFRA_HUB_API_APPLICATION_NAME', () => {
    const { INFRA_HUB_API_APPLICATION_NAME, ...env } = validEnv();

    expect(() => validate(env)).toThrow(/INFRA_HUB_API_APPLICATION_NAME/);
  });

  it('lists every invalid variable in a single error', () => {
    expect(() => validate({})).toThrow(
      /^Missing required environment variable\(s\): SERVER_SSH_HOST, SERVER_SSH_USER, SERVER_SSH_PRIVATE_KEY, PORT, LOG_LEVEL, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME, IAM_API_URL, INFRA_HUB_API_APPLICATION_NAME$/,
    );
  });

  it('never echoes the values of invalid variables in the error message', () => {
    const attempt = () =>
      validate({ ...validEnv(), PORT: 'super-secret-not-a-number' });

    expect(attempt).toThrow(/PORT/);
    expect(attempt).not.toThrow(/super-secret/);
  });
});
