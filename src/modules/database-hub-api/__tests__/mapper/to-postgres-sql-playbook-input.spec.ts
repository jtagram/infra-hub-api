import { describe, expect, it } from '@jest/globals';
import { DatabaseHubApiMapper } from '../../database-hub-api.mapper';
import { ManageDatabaseDto } from '../../database-hub-api.dto';
import {
  PostgresSqlPlaybookInput,
  PostgresSqlPlaybookInputBuilder,
} from '../../database-hub-api.playbook';

// @nestjs/typeorm / @nestjs/config are not imported by the mapper chain.
const dto: ManageDatabaseDto = {
  numberOfTickets: 9,
  namespace: 'databases',
  deployment: 'postgres',
  dbName: 'app',
  sqlCode: 'DELETE FROM t;',
};

describe('DatabaseHubApiMapper.toPostgresSqlPlaybookInput', () => {
  it('maps namespace, deployment, dbName and sqlCode', () => {
    expect(DatabaseHubApiMapper.toPostgresSqlPlaybookInput(dto)).toEqual({
      namespace: 'databases',
      deployment: 'postgres',
      dbName: 'app',
      sqlCode: 'DELETE FROM t;',
    });
  });

  it('returns a PostgresSqlPlaybookInput', () => {
    expect(DatabaseHubApiMapper.toPostgresSqlPlaybookInput(dto)).toBeInstanceOf(
      PostgresSqlPlaybookInput,
    );
  });

  it('does not carry the ticket number into the playbook input', () => {
    expect(
      DatabaseHubApiMapper.toPostgresSqlPlaybookInput(dto),
    ).not.toHaveProperty('numberOfTickets');
  });

  it('passes the values through verbatim, without trimming or escaping', () => {
    const hostile = { ...dto, sqlCode: "  '; DROP TABLE x; --  " };

    expect(
      DatabaseHubApiMapper.toPostgresSqlPlaybookInput(hostile).sqlCode,
    ).toBe("  '; DROP TABLE x; --  ");
  });

  it('matches what the playbook input builder produces', () => {
    const expected = new PostgresSqlPlaybookInputBuilder()
      .withNamespace('databases')
      .withDeployment('postgres')
      .withDbName('app')
      .withSqlCode('DELETE FROM t;')
      .build();

    expect(DatabaseHubApiMapper.toPostgresSqlPlaybookInput(dto)).toEqual(
      expected,
    );
  });
});
