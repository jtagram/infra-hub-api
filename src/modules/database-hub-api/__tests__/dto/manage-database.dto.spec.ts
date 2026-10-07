import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ManageDatabaseDto } from '../../database-hub-api.dto';

// Same options main.ts gives the global ValidationPipe (transform only affects
// the returned instance, not what is accepted).
const validateDto = (payload: Record<string, unknown>) =>
  validate(plainToInstance(ManageDatabaseDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
const propertiesWithErrors = async (payload: Record<string, unknown>) =>
  (await validateDto(payload)).map((error) => error.property);

const valid = () => ({
  numberOfTickets: 12,
  namespace: 'databases',
  deployment: 'postgres',
  dbName: 'app',
  sqlCode: 'SELECT 1;',
});

describe('ManageDatabaseDto', () => {
  it('accepts a valid payload', async () => {
    expect(await validateDto(valid())).toHaveLength(0);
  });

  it('rejects a missing numberOfTickets', async () => {
    const { numberOfTickets, ...payload } = valid();

    expect(await propertiesWithErrors(payload)).toEqual(['numberOfTickets']);
  });

  it('rejects a numberOfTickets that is a string', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), numberOfTickets: '12' }),
    ).toEqual(['numberOfTickets']);
  });

  it('rejects a decimal numberOfTickets', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), numberOfTickets: 1.5 }),
    ).toEqual(['numberOfTickets']);
  });

  it('accepts zero and negative ticket numbers (no @Min)', async () => {
    expect(await validateDto({ ...valid(), numberOfTickets: 0 })).toHaveLength(
      0,
    );
    expect(await validateDto({ ...valid(), numberOfTickets: -3 })).toHaveLength(
      0,
    );
  });

  it('rejects a missing or empty namespace', async () => {
    const { namespace, ...payload } = valid();

    expect(await propertiesWithErrors(payload)).toEqual(['namespace']);
    expect(await propertiesWithErrors({ ...valid(), namespace: '' })).toEqual([
      'namespace',
    ]);
  });

  it('accepts a namespace of 63 characters and rejects 64', async () => {
    expect(
      await validateDto({ ...valid(), namespace: 'n'.repeat(63) }),
    ).toHaveLength(0);
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

  it('rejects a missing or empty dbName', async () => {
    const { dbName, ...payload } = valid();

    expect(await propertiesWithErrors(payload)).toEqual(['dbName']);
    expect(await propertiesWithErrors({ ...valid(), dbName: '' })).toEqual([
      'dbName',
    ]);
  });

  it('does not restrict the characters of dbName (unlike CreateDatabaseDto)', async () => {
    expect(
      await validateDto({
        ...valid(),
        dbName: 'host=evil.example.com dbname=x',
      }),
    ).toHaveLength(0);
  });

  it('rejects a dbName longer than 63 characters', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), dbName: 'x'.repeat(64) }),
    ).toEqual(['dbName']);
  });

  it('rejects a missing or empty sqlCode', async () => {
    const { sqlCode, ...payload } = valid();

    expect(await propertiesWithErrors(payload)).toEqual(['sqlCode']);
    expect(await propertiesWithErrors({ ...valid(), sqlCode: '' })).toEqual([
      'sqlCode',
    ]);
  });

  it('accepts a sqlCode of 5000 characters and rejects 5001', async () => {
    expect(
      await validateDto({ ...valid(), sqlCode: 'x'.repeat(5000) }),
    ).toHaveLength(0);
    expect(
      await propertiesWithErrors({ ...valid(), sqlCode: 'x'.repeat(5001) }),
    ).toEqual(['sqlCode']);
  });

  it('rejects non-string values for the string fields', async () => {
    expect(
      await propertiesWithErrors({
        ...valid(),
        namespace: 1,
        deployment: {},
        dbName: [],
        sqlCode: true,
      }),
    ).toEqual(['namespace', 'deployment', 'dbName', 'sqlCode']);
  });

  it('rejects properties that are not part of the DTO', async () => {
    expect(await propertiesWithErrors({ ...valid(), extra: 'x' })).toEqual([
      'extra',
    ]);
  });
});
