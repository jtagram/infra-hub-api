import { randomUUID } from 'node:crypto';
import { Options } from 'pino-http';

export function buildLoggerOptions(level: string): { pinoHttp: Options } {
  return {
    pinoHttp: {
      level,
      genReqId: () => randomUUID(),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.password',
          'req.body.access_token',
          'err.parameters',
        ],
        censor: '[REDACTED]',
      },
    },
  };
}
