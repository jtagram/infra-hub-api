import { describe, expect, it } from '@jest/globals';
import { load } from 'js-yaml';
import {
  buildPostgresSqlPlaybook,
  PostgresSqlPlaybookInputBuilder,
} from '../../database-hub-api.playbook';

const build = (sqlCode: string, overrides: Record<string, string> = {}) =>
  buildPostgresSqlPlaybook(
    new PostgresSqlPlaybookInputBuilder()
      .withNamespace(overrides.namespace ?? 'databases')
      .withDeployment(overrides.deployment ?? 'postgres')
      .withDbName(overrides.dbName ?? 'app')
      .withSqlCode(sqlCode)
      .build(),
  );

type Play = {
  hosts: string;
  gather_facts: boolean;
  tasks: { name: string; 'ansible.builtin.command': { argv: string[] } }[];
};
const parsePlay = (yaml: string): Play => (load(yaml) as Play[])[0];

describe('buildPostgresSqlPlaybook', () => {
  it('generates a YAML list with a single play over all hosts without fact gathering', () => {
    const parsed = load(build('SELECT 1;')) as Play[];

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].hosts).toBe('all');
    expect(parsed[0].gather_facts).toBe(false);
  });

  it('has one task that runs psql inside the deployment through microk8s kubectl', () => {
    const play = parsePlay(build('SELECT 1;'));

    expect(play.tasks).toHaveLength(1);
    expect(play.tasks[0].name).toBe('Execute SQL against target database');
    expect(play.tasks[0]['ansible.builtin.command'].argv).toEqual([
      'microk8s',
      'kubectl',
      'exec',
      'deploy/postgres',
      '-n',
      'databases',
      '--',
      'psql',
      '-U',
      'user-db',
      '-d',
      'app',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'SELECT 1;',
    ]);
  });

  it('uses the argv form of the command module (no shell involved)', () => {
    const task = parsePlay(build('SELECT 1;')).tasks[0];

    expect(Object.keys(task)).toEqual(['name', 'ansible.builtin.command']);
    expect(task['ansible.builtin.command']).not.toHaveProperty('cmd');
    expect(task['ansible.builtin.command']).not.toHaveProperty('_raw_params');
  });

  it('keeps a hostile SQL string as one single argv element (YAML safe)', () => {
    const sql = `SELECT 1; "quoted" 'single' # not a comment\n- !!python/object: x\n: {y}`;

    const argv = parsePlay(build(sql)).tasks[0]['ansible.builtin.command'].argv;

    expect(argv).toHaveLength(16);
    expect(argv[argv.length - 1]).toBe(sql);
  });

  it('keeps hostile namespace, deployment and dbName as single argv elements', () => {
    const argv = parsePlay(
      build('SELECT 1;', {
        namespace: 'ns\n- injected',
        deployment: 'dep: x',
        dbName: '--help ; rm -rf /',
      }),
    ).tasks[0]['ansible.builtin.command'].argv;

    expect(argv).toHaveLength(16);
    expect(argv[3]).toBe('deploy/dep: x');
    expect(argv[5]).toBe('ns\n- injected');
    expect(argv[11]).toBe('--help ; rm -rf /');
  });

  it('keeps the whole SQL as the -c value even when it looks like another option', () => {
    const argv = parsePlay(build('-f /etc/passwd')).tasks[0][
      'ansible.builtin.command'
    ].argv;

    expect(argv[argv.length - 2]).toBe('-c');
    expect(argv[argv.length - 1]).toBe('-f /etc/passwd');
  });

  it('passes Jinja expressions through verbatim (no !unsafe / raw escaping, see report)', () => {
    const sql = 'SELECT \'{{ lookup("pipe", "id") }}\';';

    const argv = parsePlay(build(sql)).tasks[0]['ansible.builtin.command'].argv;

    expect(argv[argv.length - 1]).toBe(sql);
  });

  it('always logs in as the fixed "user-db" superuser', () => {
    const argv = parsePlay(build('SELECT 1;')).tasks[0][
      'ansible.builtin.command'
    ].argv;

    expect(argv[argv.indexOf('-U') + 1]).toBe('user-db');
  });

  it('stops on the first SQL error with ON_ERROR_STOP', () => {
    const argv = parsePlay(build('SELECT 1;')).tasks[0][
      'ansible.builtin.command'
    ].argv;

    expect(argv[argv.indexOf('-v') + 1]).toBe('ON_ERROR_STOP=1');
  });
});
