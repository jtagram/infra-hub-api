import { describe, expect, it } from '@jest/globals';
import { load } from 'js-yaml';
import { buildCreateDatabasePlaybook } from '../../database-hub-api.playbook';

const PSQL_AS_POSTGRES_USER_SCRIPT =
  'if [ -z "$POSTGRES_USER" ]; then ' +
  'echo "POSTGRES_USER is not set in this deployment" >&2; exit 1; fi; ' +
  'exec psql -U "$POSTGRES_USER" "$@"';

type Play = {
  hosts: string;
  gather_facts: boolean;
  tasks: { name: string; 'ansible.builtin.command': { argv: string[] } }[];
};
const parsePlay = (yaml: string): Play => (load(yaml) as Play[])[0];

describe('buildCreateDatabasePlaybook', () => {
  it('generates a single play over all hosts without fact gathering', () => {
    const parsed = load(
      buildCreateDatabasePlaybook('databases', 'postgres', 'new_db'),
    ) as Play[];

    expect(parsed).toHaveLength(1);
    expect(parsed[0].hosts).toBe('all');
    expect(parsed[0].gather_facts).toBe(false);
  });

  it('runs CREATE DATABASE against the postgres administration database', () => {
    const play = parsePlay(
      buildCreateDatabasePlaybook('databases', 'postgres', 'new_db'),
    );

    expect(play.tasks).toHaveLength(1);
    expect(play.tasks[0].name).toBe('Create database');
    expect(play.tasks[0]['ansible.builtin.command'].argv).toEqual([
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
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'CREATE DATABASE "new_db";',
    ]);
  });

  it('wraps the database name in double quotes', () => {
    const argv = parsePlay(buildCreateDatabasePlaybook('n', 'd', 'abc'))
      .tasks[0]['ansible.builtin.command'].argv;

    expect(argv[argv.length - 1]).toBe('CREATE DATABASE "abc";');
  });

  it('does not escape a double quote in dbName by itself (the DTO regex is the only barrier)', () => {
    const argv = parsePlay(
      buildCreateDatabasePlaybook('n', 'd', 'a"; DROP DATABASE x; --'),
    ).tasks[0]['ansible.builtin.command'].argv;

    expect(argv[argv.length - 1]).toBe(
      'CREATE DATABASE "a"; DROP DATABASE x; --";',
    );
  });

  it('keeps hostile namespace and deployment as single argv elements', () => {
    const argv = parsePlay(
      buildCreateDatabasePlaybook('ns; id', 'dep && id', 'db'),
    ).tasks[0]['ansible.builtin.command'].argv;

    expect(argv).toHaveLength(17);
    expect(argv[3]).toBe('deploy/dep && id');
    expect(argv[5]).toBe('ns; id');
  });
});
