import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDatabaseDto } from '../../database-hub-api.dto';

// Same options main.ts gives the global ValidationPipe (transform only affects
// the returned instance, not what is accepted).
const validateDto = (payload: Record<string, unknown>) =>
  validate(plainToInstance(CreateDatabaseDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
const propertiesWithErrors = async (payload: Record<string, unknown>) =>
  (await validateDto(payload)).map((error) => error.property);

const valid = () => ({
  numberOfTickets: 3,
  namespace: 'databases',
  deployment: 'postgres',
  dbName: 'new_db',
});

describe('CreateDatabaseDto', () => {
  it('accepts a valid payload', async () => {
    expect(await validateDto(valid())).toHaveLength(0);
  });

  it('rejects a missing numberOfTickets', async () => {
    const { numberOfTickets, ...payload } = valid();

    expect(await propertiesWithErrors(payload)).toEqual(['numberOfTickets']);
  });

  it('rejects a decimal numberOfTickets', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), numberOfTickets: 2.2 }),
    ).toEqual(['numberOfTickets']);
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

  it('rejects a missing or empty dbName', async () => {
    const { dbName, ...payload } = valid();

    expect(await propertiesWithErrors(payload)).toEqual(['dbName']);
    expect(await propertiesWithErrors({ ...valid(), dbName: '' })).toContain(
      'dbName',
    );
  });

  it('accepts lowercase identifiers with digits and underscores', async () => {
    expect(await validateDto({ ...valid(), dbName: 'db_2_x' })).toHaveLength(0);
    expect(await validateDto({ ...valid(), dbName: '_private' })).toHaveLength(
      0,
    );
  });

  it('rejects uppercase letters in dbName', async () => {
    expect(await propertiesWithErrors({ ...valid(), dbName: 'MyDb' })).toEqual([
      'dbName',
    ]);
  });

  it('rejects a dbName starting with a digit', async () => {
    expect(await propertiesWithErrors({ ...valid(), dbName: '1db' })).toEqual([
      'dbName',
    ]);
  });

  it('rejects a dbName with a hyphen or a space', async () => {
    expect(await propertiesWithErrors({ ...valid(), dbName: 'my-db' })).toEqual(
      ['dbName'],
    );
    expect(await propertiesWithErrors({ ...valid(), dbName: 'my db' })).toEqual(
      ['dbName'],
    );
  });

  it('rejects a dbName that tries to break out of the quoted identifier', async () => {
    expect(
      await propertiesWithErrors({
        ...valid(),
        dbName: 'a"; DROP DATABASE x; --',
      }),
    ).toEqual(['dbName']);
  });

  it('rejects a dbName with a trailing newline', async () => {
    expect(await propertiesWithErrors({ ...valid(), dbName: 'db\n' })).toEqual([
      'dbName',
    ]);
  });

  it('accepts a dbName of 63 characters and rejects 64', async () => {
    expect(
      await validateDto({ ...valid(), dbName: 'a'.repeat(63) }),
    ).toHaveLength(0);
    expect(
      await propertiesWithErrors({ ...valid(), dbName: 'a'.repeat(64) }),
    ).toEqual(['dbName']);
  });

  it('explains the identifier rule in the error message', async () => {
    const [error] = await validateDto({ ...valid(), dbName: 'Bad Name' });

    expect(Object.values(error.constraints ?? {})).toContain(
      'dbName must be a valid lowercase Postgres identifier',
    );
  });

  it('rejects properties that are not part of the DTO', async () => {
    expect(await propertiesWithErrors({ ...valid(), sqlCode: 'x' })).toEqual([
      'sqlCode',
    ]);
  });
});
