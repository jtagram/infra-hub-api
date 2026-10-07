import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadGatewayException } from '@nestjs/common';
import { load } from 'js-yaml';
import { Repository } from 'typeorm';
import { InfrastructureOperationsLogEntity } from '../../../../common/database/infrastructure-operatios-log.entity';
import { AnsibleExecutionResult } from '../../../ansible/ansible.dto';
import { AnsibleService } from '../../../ansible/ansible.service';
import { DatabaseHubApiService } from '../../database-hub-api.service';

// @nestjs/typeorm and @nestjs/config are ESM-only and Jest runs as CommonJS.
// The service is built by hand, so the injection decorator can be a no-op.
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));

const debugOutput = (msg: string) =>
  `TASK [Emit database names]\nok: [pcbox] => {\n    "msg": ${JSON.stringify(msg)}\n}\n`;

const ok = (stdout: string): AnsibleExecutionResult => ({
  success: true,
  stdout,
  stderr: '',
  exitCode: 0,
});

describe('DatabaseHubApiService.listDatabases', () => {
  let ansibleService: {
    execute: jest.Mock<(playbook: string) => Promise<AnsibleExecutionResult>>;
  };
  let repository: { save: jest.Mock };
  let service: DatabaseHubApiService;
  const dto = { namespace: 'databases', deployment: 'postgres' };

  beforeEach(() => {
    ansibleService = {
      execute: jest.fn<(playbook: string) => Promise<AnsibleExecutionResult>>(),
    };
    repository = { save: jest.fn() };
    service = new DatabaseHubApiService(
      ansibleService as unknown as AnsibleService,
      repository as unknown as Repository<InfrastructureOperationsLogEntity>,
    );
  });

  it('executes the list-databases playbook for the namespace and deployment', async () => {
    ansibleService.execute.mockResolvedValue(ok(debugOutput('postgres')));

    await service.listDatabases(dto);

    const [playbook] = ansibleService.execute.mock.calls[0];
    const argv = (
      load(playbook) as {
        tasks: { 'ansible.builtin.command'?: { argv: string[] } }[];
      }[]
    )[0].tasks[0]['ansible.builtin.command']!.argv;
    expect(argv).toContain('deploy/postgres');
    expect(argv[argv.indexOf('-n') + 1]).toBe('databases');
  });

  it('returns one name per line of the debug message', async () => {
    ansibleService.execute.mockResolvedValue(
      ok(debugOutput('postgres\napp\ntemplate_x\n')),
    );

    await expect(service.listDatabases(dto)).resolves.toEqual([
      'postgres',
      'app',
      'template_x',
    ]);
  });

  it('trims every line and drops empty ones', async () => {
    ansibleService.execute.mockResolvedValue(
      ok(debugOutput('  a  \n\n\t\n b\r\n')),
    );

    await expect(service.listDatabases(dto)).resolves.toEqual(['a', 'b']);
  });

  it('returns an empty list for an empty message', async () => {
    ansibleService.execute.mockResolvedValue(ok(debugOutput('')));

    await expect(service.listDatabases(dto)).resolves.toEqual([]);
  });

  it('does not write any operations log', async () => {
    ansibleService.execute.mockResolvedValue(ok(debugOutput('a')));

    await service.listDatabases(dto);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('fails with 502 and the failure detail of ansible when the playbook fails', async () => {
    ansibleService.execute.mockResolvedValue({
      success: false,
      stdout: '"msg": "non-zero return code", "stderr": "deployment not found"',
      stderr: 'ignored',
      exitCode: 2,
      errorMessage: 'ignored too',
    });

    const attempt = service.listDatabases(dto);

    await expect(attempt).rejects.toThrow(BadGatewayException);
    await expect(attempt).rejects.toThrow(
      'Failed to list databases: deployment not found',
    );
  });

  it('falls back to the process stderr when stdout has no detail', async () => {
    ansibleService.execute.mockResolvedValue({
      success: false,
      stdout: 'nothing useful',
      stderr: 'ssh: connection refused',
      exitCode: 4,
      errorMessage: 'msg',
    });

    await expect(service.listDatabases(dto)).rejects.toThrow(
      'Failed to list databases: ssh: connection refused',
    );
  });

  it('falls back to the error message when there is no stderr', async () => {
    ansibleService.execute.mockResolvedValue({
      success: false,
      stdout: '',
      stderr: '',
      exitCode: null,
      errorMessage: 'Command failed: timed out',
    });

    await expect(service.listDatabases(dto)).rejects.toThrow(
      'Failed to list databases: Command failed: timed out',
    );
  });

  it('falls back to "unknown error" when there is no detail at all', async () => {
    ansibleService.execute.mockResolvedValue({
      success: false,
      stdout: '',
      stderr: '',
      exitCode: 1,
    });

    await expect(service.listDatabases(dto)).rejects.toThrow(
      'Failed to list databases: unknown error',
    );
  });

  it('fails with 502 when a successful run has no debug message', async () => {
    ansibleService.execute.mockResolvedValue(ok('PLAY RECAP ok=1'));

    const attempt = service.listDatabases(dto);

    await expect(attempt).rejects.toThrow(BadGatewayException);
    await expect(attempt).rejects.toThrow(/^Failed to list databases$/);
  });

  it('propagates errors thrown by the ansible service (e.g. spawn failures)', async () => {
    ansibleService.execute.mockRejectedValue(
      new Error('spawn ansible-playbook ENOENT'),
    );

    await expect(service.listDatabases(dto)).rejects.toThrow('ENOENT');
  });
});
