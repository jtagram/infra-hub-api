import { dump } from 'js-yaml';

const POSTGRES_SUPERUSER = 'postgres';

export class PostgresSqlPlaybookInput {
  namespace!: string;
  deployment!: string;
  dbName!: string;
  sqlCode!: string;
}

export class PostgresSqlPlaybookInputBuilder {
  private readonly input = new PostgresSqlPlaybookInput();

  withNamespace(namespace: string): this {
    this.input.namespace = namespace;
    return this;
  }

  withDeployment(deployment: string): this {
    this.input.deployment = deployment;
    return this;
  }

  withDbName(dbName: string): this {
    this.input.dbName = dbName;
    return this;
  }

  withSqlCode(sqlCode: string): this {
    this.input.sqlCode = sqlCode;
    return this;
  }

  build(): PostgresSqlPlaybookInput {
    return this.input;
  }
}

export function buildPostgresSqlPlaybook(
  input: PostgresSqlPlaybookInput,
): string {
  const playbook = [
    {
      hosts: 'all',
      gather_facts: false,
      tasks: [
        {
          name: 'Execute SQL against target database',
          'ansible.builtin.command': {
            argv: [
              'kubectl',
              'exec',
              `deploy/${input.deployment}`,
              '-n',
              input.namespace,
              '--',
              'psql',
              '-U',
              POSTGRES_SUPERUSER,
              '-d',
              input.dbName,
              '-v',
              'ON_ERROR_STOP=1',
              '-c',
              input.sqlCode,
            ],
          },
        },
      ],
    },
  ];

  return dump(playbook);
}
