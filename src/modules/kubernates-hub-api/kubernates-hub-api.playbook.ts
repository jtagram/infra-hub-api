import { dump } from 'js-yaml';

export enum KubernetesAction {
  APPLY = 'apply',
  DELETE = 'delete',
  CREATE = 'create',
}

export class KubernetesManifestPlaybookInput {
  namespace!: string;
  action!: KubernetesAction;
  manifest!: string;
}

export class KubernetesManifestPlaybookInputBuilder {
  private readonly input = new KubernetesManifestPlaybookInput();

  withNamespace(namespace: string): this {
    this.input.namespace = namespace;
    return this;
  }

  withAction(action: KubernetesAction): this {
    this.input.action = action;
    return this;
  }

  withManifest(manifest: string): this {
    this.input.manifest = manifest;
    return this;
  }

  build(): KubernetesManifestPlaybookInput {
    return this.input;
  }
}

export function buildKubernetesManifestPlaybook(
  input: KubernetesManifestPlaybookInput,
): string {
  const playbook = [
    {
      hosts: 'all',
      gather_facts: false,
      tasks: [
        {
          name: `kubectl ${input.action} manifest`,
          'ansible.builtin.command': {
            argv: ['kubectl', input.action, '-n', input.namespace, '-f', '-'],
            stdin: input.manifest,
          },
        },
      ],
    },
  ];

  return dump(playbook);
}

export function buildListDeploymentsPlaybook(namespace: string): string {
  const playbook = [
    {
      hosts: 'all',
      gather_facts: false,
      tasks: [
        {
          name: 'List deployments in namespace',
          'ansible.builtin.command': {
            argv: [
              'kubectl',
              'get',
              'deployments',
              '-n',
              namespace,
              '-o',
              'jsonpath={.items[*].metadata.name}',
            ],
          },
        },
      ],
    },
  ];

  return dump(playbook);
}

export class KubernetesServerCommandPlaybookInput {
  command!: string;
}

export class KubernetesServerCommandPlaybookInputBuilder {
  private readonly input = new KubernetesServerCommandPlaybookInput();

  withCommand(command: string): this {
    this.input.command = command;
    return this;
  }

  build(): KubernetesServerCommandPlaybookInput {
    return this.input;
  }
}

export function buildKubernetesServerCommandPlaybook(
  input: KubernetesServerCommandPlaybookInput,
): string {
  const playbook = [
    {
      hosts: 'all',
      gather_facts: false,
      tasks: [
        {
          name: 'run server command',
          'ansible.builtin.shell': input.command,
        },
      ],
    },
  ];

  return dump(playbook);
}
