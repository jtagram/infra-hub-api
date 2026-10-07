import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListDatabasesDto } from '../../database-hub-api.dto';

// Same options main.ts gives the global ValidationPipe (transform only affects
// the returned instance, not what is accepted).
const validateDto = (payload: Record<string, unknown>) =>
  validate(plainToInstance(ListDatabasesDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
const propertiesWithErrors = async (payload: Record<string, unknown>) =>
  (await validateDto(payload)).map((error) => error.property);

const valid = () => ({ namespace: 'databases', deployment: 'postgres' });

describe('ListDatabasesDto', () => {
  it('accepts a valid query', async () => {
    expect(await validateDto(valid())).toHaveLength(0);
  });

  it('rejects a missing or empty namespace', async () => {
    const { namespace, ...payload } = valid();

    expect(await propertiesWithErrors(payload)).toEqual(['namespace']);
    expect(await propertiesWithErrors({ ...valid(), namespace: '' })).toEqual([
      'namespace',
    ]);
  });

  it('rejects a namespace longer than 63 characters', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), namespace: 'n'.repeat(64) }),
    ).toEqual(['namespace']);
  });

  it('rejects a missing or empty deployment', async () => {
    const { deployment, ...payload } = valid();

    expect(await propertiesWithErrors(payload)).toEqual(['deployment']);
    expect(await propertiesWithErrors({ ...valid(), deployment: '' })).toEqual([
      'deployment',
    ]);
  });

  it('rejects a deployment longer than 63 characters', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), deployment: 'd'.repeat(64) }),
    ).toEqual(['deployment']);
  });

  it('rejects an array value coming from a repeated query parameter', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), namespace: ['a', 'b'] }),
    ).toEqual(['namespace']);
  });

  it('rejects properties that are not part of the DTO', async () => {
    expect(await propertiesWithErrors({ ...valid(), dbName: 'x' })).toEqual([
      'dbName',
    ]);
  });
});
