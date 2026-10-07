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

const build = (
  manifest: string,
  namespace = 'default',
  action = KubernetesAction.APPLY,
) =>
  buildKubernetesManifestPlaybook(
    new KubernetesManifestPlaybookInputBuilder()
      .withNamespace(namespace)
      .withAction(action)
      .withManifest(manifest)
      .build(),
  );

describe('buildKubernetesManifestPlaybook', () => {
  it('generates a single play over all hosts without fact gathering', () => {
    const plays = parsePlays(build('kind: Pod'));

    expect(plays).toHaveLength(1);
    expect(plays[0].hosts).toBe('all');
    expect(plays[0].gather_facts).toBe(false);
  });

  it('runs microk8s kubectl <action> -n <namespace> -f - with the manifest on stdin', () => {
    const [task] = parsePlays(
      build('kind: Pod', 'prod', KubernetesAction.DELETE),
    )[0].tasks;

    expect(task.name).toBe('kubectl delete manifest');
    expect(task['ansible.builtin.command']).toEqual({
      argv: ['microk8s', 'kubectl', 'delete', '-n', 'prod', '-f', '-'],
      stdin: 'kind: Pod',
    });
  });

  it('names the task after each action', () => {
    expect(
      parsePlays(build('x', 'n', KubernetesAction.APPLY))[0].tasks[0].name,
    ).toBe('kubectl apply manifest');
    expect(
      parsePlays(build('x', 'n', KubernetesAction.CREATE))[0].tasks[0].name,
    ).toBe('kubectl create manifest');
  });

  it('has exactly one task using the argv form (no shell)', () => {
    const [play] = parsePlays(build('kind: Pod'));

    expect(play.tasks).toHaveLength(1);
    expect(Object.keys(play.tasks[0])).toEqual([
      'name',
      'ansible.builtin.command',
    ]);
  });

  it('keeps a multi-line manifest intact on stdin', () => {
    const manifest =
      'apiVersion: v1\nkind: ConfigMap\ndata:\n  key: "va: lue"\n---\nkind: Pod\n';

    const command = parsePlays(build(manifest))[0].tasks[0][
      'ansible.builtin.command'
    ] as { stdin: string };

    expect(command.stdin).toBe(manifest);
  });

  it('keeps a hostile namespace as a single argv element', () => {
    const [task] = parsePlays(build('kind: Pod', 'ns; rm -rf /\n- x'))[0].tasks;

    expect(argvOf(task)).toEqual([
      'microk8s',
      'kubectl',
      'apply',
      '-n',
      'ns; rm -rf /\n- x',
      '-f',
      '-',
    ]);
  });

  it('cannot let a manifest break out of its YAML string into extra tasks', () => {
    const manifest = "x\n- hosts: all\n  tasks:\n    - shell: id\n'";

    const plays = parsePlays(build(manifest));

    expect(plays).toHaveLength(1);
    expect(plays[0].tasks).toHaveLength(1);
    expect(
      (plays[0].tasks[0]['ansible.builtin.command'] as { stdin: string }).stdin,
    ).toBe(manifest);
  });

  it('passes Jinja expressions in the manifest through verbatim (no !unsafe / raw escaping, see report)', () => {
    const manifest = "data: {{ lookup('pipe', 'id') }}";

    const command = parsePlays(build(manifest))[0].tasks[0][
      'ansible.builtin.command'
    ] as { stdin: string };

    expect(command.stdin).toBe(manifest);
  });
});
