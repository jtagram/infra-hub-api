import { rm } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { createTempFile } from '../../common/helpers/temp-file.helper';
import { AnsibleConnector } from './ansible.connector';
import { AnsibleExecutionResult } from './ansible.dto';
import { AnsibleValidator } from './ansible.validator';

export type { AnsibleExecutionResult } from './ansible.dto';

@Injectable()
export class AnsibleService {
  private static readonly PLAYBOOK_TEMP_DIR_PREFIX = 'pcbox-playbook-';
  private static readonly PLAYBOOK_FILE_NAME = 'playbook.yml';
  private static readonly SSH_KEY_TEMP_DIR_PREFIX = 'pcbox-ssh-key-';
  private static readonly SSH_KEY_FILE_NAME = 'pcbox_deploy_key';
  private static readonly SSH_KEY_FILE_MODE = 0o600;

  private readonly sshPrivateKey: string;

  constructor(
    private readonly ansibleConnector: AnsibleConnector,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.sshPrivateKey = this.configService.get<string>(
      'SERVER_SSH_PRIVATE_KEY',
    )!;
  }

  async execute(fileContent: string): Promise<AnsibleExecutionResult> {
    AnsibleValidator.assertValidYamlPlaybook(fileContent);

    const playbook = await createTempFile(
      AnsibleService.PLAYBOOK_TEMP_DIR_PREFIX,
      AnsibleService.PLAYBOOK_FILE_NAME,
      fileContent,
    );
    const sshKey = await createTempFile(
      AnsibleService.SSH_KEY_TEMP_DIR_PREFIX,
      AnsibleService.SSH_KEY_FILE_NAME,
      this.sshPrivateKey,
      AnsibleService.SSH_KEY_FILE_MODE,
    );

    try {
      const result = await this.ansibleConnector.executePlaybook(
        playbook.filePath,
        sshKey.filePath,
      );
      this.logResult(result);
      return result;
    } finally {
      await rm(playbook.tempDir, { recursive: true, force: true });
      await rm(sshKey.tempDir, { recursive: true, force: true });
    }
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
