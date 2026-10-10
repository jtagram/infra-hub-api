import { describe, expect, it } from '@jest/globals';
import { load } from 'js-yaml';
import { buildListDatabasesPlaybook } from '../../database-hub-api.playbook';

const PSQL_AS_POSTGRES_USER_SCRIPT =
  'if [ -z "$POSTGRES_USER" ]; then ' +
  'echo "POSTGRES_USER is not set in this deployment" >&2; exit 1; fi; ' +
  'exec psql -U "$POSTGRES_USER" "$@"';

type Task = Record<string, unknown> & { name: string };
type Play = { hosts: string; gather_facts: boolean; tasks: Task[] };
const parsePlay = (yaml: string): Play => (load(yaml) as Play[])[0];

describe('buildListDatabasesPlaybook', () => {
  it('generates a single play over all hosts without fact gathering', () => {
    const parsed = load(
      buildListDatabasesPlaybook('databases', 'postgres'),
    ) as Play[];

    expect(parsed).toHaveLength(1);
    expect(parsed[0].hosts).toBe('all');
    expect(parsed[0].gather_facts).toBe(false);
  });

  it('queries pg_database through psql in the deployment and registers the result', () => {
    const [query] = parsePlay(
      buildListDatabasesPlaybook('databases', 'postgres'),
    ).tasks;

    expect(query.name).toBe('List databases in target deployment');
    expect(query.register).toBe('result');
    expect(query['ansible.builtin.command']).toEqual({
      argv: [
        'microk8s',
        'kubectl',
        'exec',
        'deploy/postgres',
        '-n',
        'databases',
        '--',
        'sh',
        '-c',
        PSQL_AS_POSTGRES_USER_SCRIPT,
        'sh',
        '-tAc',
        'SELECT datname FROM pg_database WHERE datistemplate = false;',
      ],
    });
  });

  it('emits the registered stdout through a debug task so it can be parsed back', () => {
    const emit = parsePlay(buildListDatabasesPlaybook('databases', 'postgres'))
      .tasks[1];

    expect(emit.name).toBe('Emit database names');
    expect(emit['ansible.builtin.debug']).toEqual({
      msg: '{{ result.stdout }}',
    });
  });

  it('has exactly two tasks', () => {
    expect(parsePlay(buildListDatabasesPlaybook('a', 'b')).tasks).toHaveLength(
      2,
    );
  });

  it('keeps hostile namespace and deployment as single argv elements', () => {
    const [query] = parsePlay(
      buildListDatabasesPlaybook('ns\n- x', 'dep: y'),
    ).tasks;
    const argv = (query['ansible.builtin.command'] as { argv: string[] }).argv;

    expect(argv).toHaveLength(13);
    expect(argv[3]).toBe('deploy/dep: y');
    expect(argv[5]).toBe('ns\n- x');
  });
});
