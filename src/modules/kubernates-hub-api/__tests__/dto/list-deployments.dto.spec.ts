import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListDeploymentsDto } from '../../kubernates-hub-api.dto';

// Same options main.ts gives the global ValidationPipe (transform only affects
// the returned instance, not what is accepted).
const validateDto = (payload: Record<string, unknown>) =>
  validate(plainToInstance(ListDeploymentsDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
const propertiesWithErrors = async (payload: Record<string, unknown>) =>
  (await validateDto(payload)).map((error) => error.property);

describe('ListDeploymentsDto', () => {
  it('accepts a valid query', async () => {
    expect(await validateDto({ namespace: 'default' })).toHaveLength(0);
  });

  it('rejects a missing namespace', async () => {
    expect(await propertiesWithErrors({})).toEqual(['namespace']);
  });

  it('rejects an empty namespace', async () => {
    expect(await propertiesWithErrors({ namespace: '' })).toEqual([
      'namespace',
    ]);
  });

  it('accepts a namespace of 63 characters and rejects 64', async () => {
    expect(await validateDto({ namespace: 'n'.repeat(63) })).toHaveLength(0);
    expect(await propertiesWithErrors({ namespace: 'n'.repeat(64) })).toEqual([
      'namespace',
    ]);
  });

  it('rejects an array value coming from a repeated query parameter', async () => {
    expect(await propertiesWithErrors({ namespace: ['a', 'b'] })).toEqual([
      'namespace',
    ]);
  });

  it('rejects properties that are not part of the DTO', async () => {
    expect(
      await propertiesWithErrors({ namespace: 'default', extra: 'x' }),
    ).toEqual(['extra']);
  });
});
