import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import {
  ExecFileError,
  execFileAsync,
} from '../../../common/helpers/exec-file.helper';
import { AnsibleConnector } from '../ansible.connector';

// @nestjs/config is ESM-only and Jest runs as CommonJS. The connector is built
// by hand below, so only the class token needs to exist.
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));
// Safety: ansible-playbook must never run for real. The process execution
// layer is replaced; only the ExecFileError class stays real.
jest.mock('../../../common/helpers/exec-file.helper', () => ({
  ...jest.requireActual<
    typeof import('../../../common/helpers/exec-file.helper')
  >('../../../common/helpers/exec-file.helper'),
  execFileAsync: jest.fn(),
}));

const execMock = execFileAsync as unknown as jest.Mock<
  (...args: unknown[]) => Promise<unknown>
>;

describe('AnsibleConnector.executePlaybook', () => {
  let configService: { get: jest.Mock };
  let connector: AnsibleConnector;

  beforeEach(() => {
    execMock.mockReset();
    configService = {
      get: jest.fn(
        (key: string) =>
          ({ SERVER_SSH_HOST: 'pcbox.example.com', SERVER_SSH_USER: 'deploy' })[
            key
          ],
      ),
    };
    connector = new AnsibleConnector(configService as unknown as ConfigService);
  });

  it('reads the ssh host and user from the configuration', () => {
    expect(configService.get).toHaveBeenCalledWith('SERVER_SSH_HOST');
    expect(configService.get).toHaveBeenCalledWith('SERVER_SSH_USER');
  });

  it('runs ansible-playbook with the exact arguments and the 240s timeout', async () => {
    execMock.mockResolvedValue({ stdout: '', stderr: '' });

    await connector.executePlaybook('/tmp/p/playbook.yml', '/tmp/k/key');

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(
      'ansible-playbook',
      [
        '-i',
        'pcbox.example.com,',
        '-u',
        'deploy',
        '--private-key',
        '/tmp/k/key',
        '--ssh-common-args',
        '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
        '/tmp/p/playbook.yml',
      ],
      { timeout: 240_000 },
    );
  });

  it('passes the host as a single inventory argument with a trailing comma', async () => {
    execMock.mockResolvedValue({ stdout: '', stderr: '' });

    await connector.executePlaybook('/p', '/k');

    const args = execMock.mock.calls[0][1] as string[];
    expect(args[args.indexOf('-i') + 1]).toBe('pcbox.example.com,');
  });

  it('returns a successful result with the process outputs', async () => {
    execMock.mockResolvedValue({ stdout: 'PLAY RECAP', stderr: 'warning' });

    await expect(connector.executePlaybook('/p', '/k')).resolves.toEqual({
      success: true,
      stdout: 'PLAY RECAP',
      stderr: 'warning',
      exitCode: 0,
    });
  });

  it('turns a failed process into a failed result instead of throwing', async () => {
    execMock.mockRejectedValue(
      new ExecFileError('Command failed', 2, 'fatal output', 'some stderr'),
    );

    await expect(connector.executePlaybook('/p', '/k')).resolves.toEqual({
      success: false,
      stdout: 'fatal output',
      stderr: 'some stderr',
      exitCode: 2,
      errorMessage: 'Command failed',
      errorCode: 2,
    });
  });

  it('reports a timeout as a failed result', async () => {
    execMock.mockRejectedValue(
      new ExecFileError('Command failed: timed out', null, '', ''),
    );

    await expect(connector.executePlaybook('/p', '/k')).resolves.toMatchObject({
      success: false,
      exitCode: null,
    });
  });

  it('rethrows errors that are not ExecFileError', async () => {
    execMock.mockRejectedValue(new TypeError('unexpected'));

    await expect(connector.executePlaybook('/p', '/k')).rejects.toThrow(
      TypeError,
    );
  });
});
