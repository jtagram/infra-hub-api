import { dump } from 'js-yaml';

export class ServerCommandPlaybookInput {
  command!: string;
}

export class ServerCommandPlaybookInputBuilder {
  private readonly input = new ServerCommandPlaybookInput();

  withCommand(command: string): this {
    this.input.command = command;
    return this;
  }

  build(): ServerCommandPlaybookInput {
    return this.input;
  }
}

export function buildServerCommandPlaybook(
  input: ServerCommandPlaybookInput,
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
