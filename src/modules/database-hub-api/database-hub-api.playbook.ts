import { dump } from 'js-yaml';

// pcbox has no standalone `kubectl` binary — only the one bundled with the
// microk8s snap, invoked as `microk8s kubectl`.
const KUBECTL = ['microk8s', 'kubectl'];

const POSTGRES_SUPERUSER = 'postgres';
const POSTGRES_ADMIN_DATABASE = 'postgres';

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
              ...KUBECTL,
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

export function buildCreateDatabasePlaybook(
  namespace: string,
  deployment: string,
  dbName: string,
): string {
  const playbook = [
    {
      hosts: 'all',
      gather_facts: false,
      tasks: [
        {
          name: 'Create database',
          'ansible.builtin.command': {
            argv: [
              ...KUBECTL,
              'exec',
              `deploy/${deployment}`,
              '-n',
              namespace,
              '--',
              'psql',
              '-U',
              POSTGRES_SUPERUSER,
              '-d',
              POSTGRES_ADMIN_DATABASE,
              '-v',
              'ON_ERROR_STOP=1',
              '-c',
              `CREATE DATABASE "${dbName}";`,
            ],
          },
        },
      ],
    },
  ];

  return dump(playbook);
}

const LIST_DATABASES_QUERY =
  'SELECT datname FROM pg_database WHERE datistemplate = false;';

export function buildListDatabasesPlaybook(
  namespace: string,
  deployment: string,
): string {
  const playbook = [
    {
      hosts: 'all',
      gather_facts: false,
      tasks: [
        {
          name: 'List databases in target deployment',
          'ansible.builtin.command': {
            argv: [
              ...KUBECTL,
              'exec',
              `deploy/${deployment}`,
              '-n',
              namespace,
              '--',
              'psql',
              '-U',
              POSTGRES_SUPERUSER,
              '-tAc',
              LIST_DATABASES_QUERY,
            ],
          },
          register: 'result',
        },
        {
          // ansible.builtin.command never prints its own stdout to the
          // console — this debug task is what actually surfaces it so
          // DatabaseHubApiService.listDatabases can parse it back out of
          // the ansible-playbook output (see extractAnsibleDebugMessage).
          name: 'Emit database names',
          'ansible.builtin.debug': {
            msg: '{{ result.stdout }}',
          },
        },
      ],
    },
  ];

  return dump(playbook);
}
