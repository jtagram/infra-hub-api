import { describe, expect, it } from '@jest/globals';
import { load } from 'js-yaml';
import {
  buildKubectlCommandPlaybook,
  buildKubernetesManifestPlaybook,
  buildListDeploymentsPlaybook,
  KubectlCommandPlaybookInput,
  KubectlCommandPlaybookInputBuilder,
  KubernetesAction,
  KubernetesManifestPlaybookInput,
  KubernetesManifestPlaybookInputBuilder,
} from '../../kubernates-hub-api.playbook';

type Task = Record<string, unknown> & { name: string };
type Play = { hosts: string; gather_facts: boolean; tasks: Task[] };
const parsePlays = (yaml: string): Play[] => load(yaml) as Play[];
const argvOf = (task: Task): string[] =>
  (task['ansible.builtin.command'] as { argv: string[] }).argv;

const build = (kubectlCommand: string) =>
  buildKubectlCommandPlaybook(
    new KubectlCommandPlaybookInputBuilder()
      .withKubectlCommand(kubectlCommand)
      .build(),
  );

describe('buildKubectlCommandPlaybook', () => {
  it('generates a single play over all hosts without fact gathering', () => {
    const plays = parsePlays(build('get pods'));

    expect(plays).toHaveLength(1);
    expect(plays[0].hosts).toBe('all');
    expect(plays[0].gather_facts).toBe(false);
  });

  it('prefixes the command with microk8s kubectl and splits it on whitespace', () => {
    const [task] = parsePlays(build('get pods -n default'))[0].tasks;

    expect(task.name).toBe('run kubectl command');
    expect(argvOf(task)).toEqual([
      'microk8s',
      'kubectl',
      'get',
      'pods',
      '-n',
      'default',
    ]);
  });

  it('trims the command and collapses runs of whitespace, tabs and newlines', () => {
    const [task] = parsePlays(build('  get \t pods\n\n-A  '))[0].tasks;

    expect(argvOf(task)).toEqual(['microk8s', 'kubectl', 'get', 'pods', '-A']);
  });

  it('does not interpret shell metacharacters: they become plain argv elements', () => {
    const [task] = parsePlays(
      build('get pods; rm -rf / && id | cat $(whoami)'),
    )[0].tasks;

    expect(argvOf(task)).toEqual([
      'microk8s',
      'kubectl',
      'get',
      'pods;',
      'rm',
      '-rf',
      '/',
      '&&',
      'id',
      '|',
      'cat',
      '$(whoami)',
    ]);
  });

  it('cannot add extra tasks or plays through YAML syntax in the command', () => {
    const plays = parsePlays(build('get pods\n- hosts: all\n  tasks: []'));

    expect(plays).toHaveLength(1);
    expect(plays[0].tasks).toHaveLength(1);
  });

  it('does not support quoting: quotes are kept as part of the arguments', () => {
    const [task] = parsePlays(build('get pods -l "app=a b"'))[0].tasks;

    expect(argvOf(task)).toEqual([
      'microk8s',
      'kubectl',
      'get',
      'pods',
      '-l',
      '"app=a',
      'b"',
    ]);
  });

  it('lets any kubectl verb and flag through (no allow-list, see report)', () => {
    const [task] = parsePlays(
      build('--kubeconfig /tmp/other delete ns production'),
    )[0].tasks;

    expect(argvOf(task)).toEqual([
      'microk8s',
      'kubectl',
      '--kubeconfig',
      '/tmp/other',
      'delete',
      'ns',
      'production',
    ]);
  });

  it('produces an empty trailing argument for a whitespace-only command', () => {
    const [task] = parsePlays(build('   '))[0].tasks;

    expect(argvOf(task)).toEqual(['microk8s', 'kubectl', '']);
  });

  it('passes Jinja expressions through verbatim (no !unsafe / raw escaping, see report)', () => {
    const [task] = parsePlays(build("get {{lookup('pipe','id')}}"))[0].tasks;

    expect(argvOf(task)).toEqual([
      'microk8s',
      'kubectl',
      'get',
      "{{lookup('pipe','id')}}",
    ]);
  });
});
