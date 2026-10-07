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

describe('KubernetesManifestPlaybookInputBuilder', () => {
  it('builds an input with every given field', () => {
    const input = new KubernetesManifestPlaybookInputBuilder()
      .withNamespace('ns')
      .withAction(KubernetesAction.CREATE)
      .withManifest('kind: Pod')
      .build();

    expect(input).toBeInstanceOf(KubernetesManifestPlaybookInput);
    expect(input).toEqual({
      namespace: 'ns',
      action: 'create',
      manifest: 'kind: Pod',
    });
  });

  it('chains the setters and returns the builder', () => {
    const builder = new KubernetesManifestPlaybookInputBuilder();

    expect(builder.withNamespace('a')).toBe(builder);
    expect(builder.withAction(KubernetesAction.APPLY)).toBe(builder);
    expect(builder.withManifest('a')).toBe(builder);
  });
});

describe('KubectlCommandPlaybookInputBuilder', () => {
  it('builds an input with the kubectl command', () => {
    const input = new KubectlCommandPlaybookInputBuilder()
      .withKubectlCommand('get pods')
      .build();

    expect(input).toBeInstanceOf(KubectlCommandPlaybookInput);
    expect(input).toEqual({ kubectlCommand: 'get pods' });
  });

  it('chains the setter and returns the builder', () => {
    const builder = new KubectlCommandPlaybookInputBuilder();

    expect(builder.withKubectlCommand('a')).toBe(builder);
  });
});
