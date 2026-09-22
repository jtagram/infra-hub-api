import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  execFileAsync,
  ExecFileError,
} from '../../common/helpers/exec-file.helper';
import { AnsiblePlaybookExecutionError } from './ansible.exception';
import { AnsibleExecutionResult } from './ansible.dto';
import { AnsibleMapper } from './ansible.mapper';

@Injectable()
export class AnsibleConnector {
  private static readonly PLAYBOOK_TIMEOUT_MS = 240_000;
  private static readonly ANSIBLE_PLAYBOOK_COMMAND = 'ansible-playbook';

  private readonly sshHost: string;
  private readonly sshUser: string;

  constructor(private readonly configService: ConfigService) {
    this.sshHost = this.configService.get<string>('SERVER_SSH_HOST')!;
    this.sshUser = this.configService.get<string>('SERVER_SSH_USER')!;
  }

  async executePlaybook(
    playbookPath: string,
    sshPrivateKeyPath: string,
  ): Promise<AnsibleExecutionResult> {
    try {
      const { stdout, stderr } = await execFileAsync(
        AnsibleConnector.ANSIBLE_PLAYBOOK_COMMAND,
        this.buildPlaybookArgs(playbookPath, sshPrivateKeyPath),
        this.buildExecOptions(),
      );
      return AnsibleMapper.toSuccessResult(stdout, stderr);
    } catch (error) {
      if (!(error instanceof ExecFileError)) {
        throw error;
      }
      return AnsibleMapper.toFailureResult(
        new AnsiblePlaybookExecutionError(
          error.message,
          error.code,
          error.stdout,
          error.stderr,
        ),
      );
    }
  }

  private buildPlaybookArgs(
    playbookPath: string,
    sshPrivateKeyPath: string,
  ): string[] {
    return [
      '-i',
      `${this.sshHost},`,
      '-u',
      this.sshUser,
      '--private-key',
      sshPrivateKeyPath,
      '--ssh-common-args',
      '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
      playbookPath,
    ];
  }

  private buildExecOptions(): { timeout: number } {
    return { timeout: AnsibleConnector.PLAYBOOK_TIMEOUT_MS };
  }
}
