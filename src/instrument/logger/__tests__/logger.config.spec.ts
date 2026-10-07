import { describe, expect, it } from '@jest/globals';
import { buildLoggerOptions } from '../logger.config';

describe('buildLoggerOptions', () => {
  it('uses the given log level', () => {
    expect(buildLoggerOptions('warn').pinoHttp.level).toBe('warn');
  });

  it('generates a different UUID request id on every call', () => {
    const { genReqId } = buildLoggerOptions('info').pinoHttp;
    const generate = genReqId as () => string;

    const first = generate();
    const second = generate();

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(second).not.toBe(first);
  });

  it('redacts credentials, cookies and sensitive body fields', () => {
    const redact = buildLoggerOptions('info').pinoHttp.redact as {
      paths: string[];
      censor: string;
    };

    expect(redact.paths).toEqual([
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'req.body.password',
      'req.body.access_token',
      'err.parameters',
    ]);
    expect(redact.censor).toBe('[REDACTED]');
  });
});
