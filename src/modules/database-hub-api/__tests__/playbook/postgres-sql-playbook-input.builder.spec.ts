import { describe, expect, it } from '@jest/globals';
import {
  PostgresSqlPlaybookInput,
  PostgresSqlPlaybookInputBuilder,
} from '../../database-hub-api.playbook';

describe('PostgresSqlPlaybookInputBuilder', () => {
  it('builds an input with every given field', () => {
    const input = new PostgresSqlPlaybookInputBuilder()
      .withNamespace('ns')
      .withDeployment('dep')
      .withDbName('db')
      .withSqlCode('SELECT 1')
      .build();

    expect(input).toBeInstanceOf(PostgresSqlPlaybookInput);
    expect(input).toEqual({
      namespace: 'ns',
      deployment: 'dep',
      dbName: 'db',
      sqlCode: 'SELECT 1',
    });
  });

  it('chains the setters and returns the builder', () => {
    const builder = new PostgresSqlPlaybookInputBuilder();

    expect(builder.withNamespace('a')).toBe(builder);
    expect(builder.withDeployment('a')).toBe(builder);
    expect(builder.withDbName('a')).toBe(builder);
    expect(builder.withSqlCode('a')).toBe(builder);
  });
});
