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

describe('buildListDeploymentsPlaybook', () => {
  it('generates a single play over all hosts without fact gathering', () => {
    const plays = parsePlays(buildListDeploymentsPlaybook('default'));

    expect(plays).toHaveLength(1);
    expect(plays[0].hosts).toBe('all');
    expect(plays[0].gather_facts).toBe(false);
  });

  it('gets the deployment names with a jsonpath query and registers the result', () => {
    const [query] = parsePlays(buildListDeploymentsPlaybook('prod'))[0].tasks;

    expect(query.name).toBe('List deployments in namespace');
    expect(query.register).toBe('result');
    expect(argvOf(query)).toEqual([
      'microk8s',
      'kubectl',
      'get',
      'deployments',
      '-n',
      'prod',
      '-o',
      'jsonpath={.items[*].metadata.name}',
    ]);
  });

  it('emits the registered stdout through a debug task so it can be parsed back', () => {
    const emit = parsePlays(buildListDeploymentsPlaybook('prod'))[0].tasks[1];

    expect(emit.name).toBe('Emit deployment names');
    expect(emit['ansible.builtin.debug']).toEqual({
      msg: '{{ result.stdout }}',
    });
  });

  it('keeps a hostile namespace as a single argv element', () => {
    const [query] = parsePlays(
      buildListDeploymentsPlaybook('x -o yaml; id\n- y'),
    )[0].tasks;

    expect(argvOf(query)).toHaveLength(8);
    expect(argvOf(query)[5]).toBe('x -o yaml; id\n- y');
  });
});
