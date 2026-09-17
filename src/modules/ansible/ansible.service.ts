import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AnsibleConnector } from './ansible.connector';
import { AnsibleExecutionResult } from './ansible.dto';
import { AnsibleValidator } from './ansible.validator';

export type { AnsibleExecutionResult } from './ansible.dto';

@Injectable()
export class AnsibleService {
  constructor(
    private readonly ansibleConnector: AnsibleConnector,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  async execute(fileContent: string): Promise<AnsibleExecutionResult> {
    AnsibleValidator.assertValidYamlPlaybook(fileContent);

    const result = await this.ansibleConnector.executePlaybook(fileContent);
    this.logResult(result);
    return result;
  }

  private logResult(result: AnsibleExecutionResult): void {
    const level = result.success ? 'log' : 'error';
    this.logger[level]({
      sshHost: this.configService.get<string>('SERVER_SSH_HOST'),
      exitCode: result.exitCode,
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      msg: 'Ansible playbook execution against pcbox',
    });
  }
}
