import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { rm } from 'node:fs/promises';
import { createTempFile } from '../../../common/helpers/temp-file.helper';
import { AnsibleConnector } from '../ansible.connector';
import { AnsibleExecutionResult } from '../ansible.dto';
import { AnsibleService } from '../ansible.service';

// @nestjs/config is ESM-only and Jest runs as CommonJS. The service is built
// by hand below, so only the class token needs to exist.
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));
// Safety: nothing is written to or removed from the real file system.
jest.mock('node:fs/promises', () => ({ rm: jest.fn() }));
jest.mock('../../../common/helpers/temp-file.helper', () => ({
  createTempFile: jest.fn(),
}));

const rmMock = rm as unknown as jest.Mock<
  (...args: unknown[]) => Promise<void>
>;
const createTempFileMock = createTempFile as unknown as jest.Mock<
  (...args: unknown[]) => Promise<{ tempDir: string; filePath: string }>
>;

const PLAYBOOK = '- hosts: all\n  tasks: []\n';
const SUCCESS: AnsibleExecutionResult = {
  success: true,
  stdout: 'out',
  stderr: '',
  exitCode: 0,
};
const FAILURE: AnsibleExecutionResult = {
  success: false,
  stdout: 'fatal',
  stderr: 'err',
  exitCode: 2,
  errorMessage: 'failed',
  errorCode: 2,
};

describe('AnsibleService.execute', () => {
  let connector: {
    executePlaybook: jest.Mock<(...a: unknown[]) => Promise<unknown>>;
  };
  let logger: { log: jest.Mock; error: jest.Mock };
  let configService: { get: jest.Mock };
  let service: AnsibleService;

  beforeEach(() => {
    rmMock.mockReset();
    rmMock.mockResolvedValue(undefined);
    createTempFileMock.mockReset();
    createTempFileMock
      .mockResolvedValueOnce({
        tempDir: '/tmp/pcbox-playbook-1',
        filePath: '/tmp/pcbox-playbook-1/playbook.yml',
      })
      .mockResolvedValueOnce({
        tempDir: '/tmp/pcbox-ssh-key-1',
        filePath: '/tmp/pcbox-ssh-key-1/pcbox_deploy_key',
      });
    connector = {
      executePlaybook: jest.fn<(...a: unknown[]) => Promise<unknown>>(),
    };
    connector.executePlaybook.mockResolvedValue(SUCCESS);
    logger = { log: jest.fn(), error: jest.fn() };
    configService = {
      get: jest.fn(
        (key: string) =>
          ({
            SERVER_SSH_PRIVATE_KEY: 'PRIVATE-KEY-CONTENT',
            SERVER_SSH_HOST: 'pcbox.example.com',
          })[key],
      ),
    };
    service = new AnsibleService(
      connector as unknown as AnsibleConnector,
      configService as unknown as ConfigService,
      logger as unknown as Logger,
    );
  });

  it('writes the playbook to a temp file named playbook.yml', async () => {
    await service.execute(PLAYBOOK);

    expect(createTempFileMock).toHaveBeenNthCalledWith(
      1,
      'pcbox-playbook-',
      'playbook.yml',
      PLAYBOOK,
    );
  });

  it('writes the ssh private key to a temp file with mode 0600', async () => {
    await service.execute(PLAYBOOK);

    expect(createTempFileMock).toHaveBeenNthCalledWith(
      2,
      'pcbox-ssh-key-',
      'pcbox_deploy_key',
      'PRIVATE-KEY-CONTENT',
      0o600,
    );
  });

  it('runs the connector with the playbook and key paths and returns its result', async () => {
    await expect(service.execute(PLAYBOOK)).resolves.toBe(SUCCESS);

    expect(connector.executePlaybook).toHaveBeenCalledWith(
      '/tmp/pcbox-playbook-1/playbook.yml',
      '/tmp/pcbox-ssh-key-1/pcbox_deploy_key',
    );
  });

  it('removes both temp directories after a successful run', async () => {
    await service.execute(PLAYBOOK);

    expect(rmMock).toHaveBeenCalledTimes(2);
    expect(rmMock).toHaveBeenCalledWith('/tmp/pcbox-playbook-1', {
      recursive: true,
      force: true,
    });
    expect(rmMock).toHaveBeenCalledWith('/tmp/pcbox-ssh-key-1', {
      recursive: true,
      force: true,
    });
  });

  it('removes both temp directories when the connector throws', async () => {
    connector.executePlaybook.mockRejectedValue(new Error('spawn failed'));

    await expect(service.execute(PLAYBOOK)).rejects.toThrow('spawn failed');

    expect(rmMock).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid playbook before creating any temp file or running anything', async () => {
    await expect(service.execute('hosts: all')).rejects.toThrow(
      'Invalid Ansible playbook: expected a YAML list of plays',
    );

    expect(createTempFileMock).not.toHaveBeenCalled();
    expect(connector.executePlaybook).not.toHaveBeenCalled();
    expect(rmMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid playbook with a plain Error, not an HttpException (so Nest answers 500, not 400)', async () => {
    const attempt = service.execute('hosts: all');

    await expect(attempt).rejects.toBeInstanceOf(Error);
    await expect(attempt).rejects.not.toBeInstanceOf(HttpException);
  });

  it('rejects malformed YAML before creating any temp file', async () => {
    await expect(service.execute('- [unclosed')).rejects.toThrow(
      /^Invalid YAML playbook/,
    );

    expect(createTempFileMock).not.toHaveBeenCalled();
  });

  it('logs a successful run at log level', async () => {
    await service.execute(PLAYBOOK);

    expect(logger.log).toHaveBeenCalledWith({
      sshHost: 'pcbox.example.com',
      exitCode: 0,
      success: true,
      stdout: 'out',
      stderr: '',
      msg: 'Ansible playbook execution against pcbox',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs a failed run at error level and still returns the failure', async () => {
    connector.executePlaybook.mockResolvedValue(FAILURE);

    await expect(service.execute(PLAYBOOK)).resolves.toBe(FAILURE);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, exitCode: 2, stdout: 'fatal' }),
    );
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('never logs the ssh private key', async () => {
    await service.execute(PLAYBOOK);

    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(
      'PRIVATE-KEY-CONTENT',
    );
  });
});
