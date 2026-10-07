import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { BadGatewayException } from '@nestjs/common';
import { load } from 'js-yaml';
import { DataSource, Repository } from 'typeorm';
import { createInMemoryDataSource } from '../../../../../test/helpers/in-memory-db';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
} from '../../../../common/database/infrastructure-operatios-log.entity';
import { AnsibleExecutionResult } from '../../../ansible/ansible.dto';
import { AnsibleService } from '../../../ansible/ansible.service';
import { KubernetesAction } from '../../kubernates-hub-api.playbook';
import { KubernetesHubApiService } from '../../kubernates-hub-api.service';

// @nestjs/typeorm and @nestjs/config are ESM-only and Jest runs as CommonJS.
// The service is built by hand, so the injection decorator can be a no-op.
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));

const SUCCESS: AnsibleExecutionResult = {
  success: true,
  stdout: 'ok',
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
const debugOutput = (msg: string) =>
  `TASK [Emit deployment names]\nok: [pcbox] => {\n    "msg": ${JSON.stringify(msg)}\n}\n`;
const tasksOf = (playbook: string) =>
  (load(playbook) as { tasks: Record<string, any>[] }[])[0].tasks;

describe('KubernetesHubApiService.listDeployments (in-memory db)', () => {
  let dataSource: DataSource;
  let repository: Repository<InfrastructureOperationsLogEntity>;
  let ansibleService: {
    execute: jest.Mock<(playbook: string) => Promise<AnsibleExecutionResult>>;
  };
  let service: KubernetesHubApiService;

  beforeAll(async () => {
    dataSource = await createInMemoryDataSource([
      InfrastructureOperationsLogEntity,
    ]);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    repository = dataSource.getRepository(InfrastructureOperationsLogEntity);
    await repository.clear();
    ansibleService = {
      execute: jest.fn<(playbook: string) => Promise<AnsibleExecutionResult>>(),
    };
    ansibleService.execute.mockResolvedValue(SUCCESS);
    service = new KubernetesHubApiService(
      ansibleService as unknown as AnsibleService,
      repository,
    );
  });

  const dto = { namespace: 'prod' };

  it('executes the list-deployments playbook for the namespace', async () => {
    ansibleService.execute.mockResolvedValue({
      ...SUCCESS,
      stdout: debugOutput('api'),
    });

    await service.listDeployments(dto);

    const [query] = tasksOf(ansibleService.execute.mock.calls[0][0]);
    expect(query['ansible.builtin.command'].argv).toEqual([
      'microk8s',
      'kubectl',
      'get',
      'deployments',
      '-n',
      'prod',
      '-o',
      'jsonpath={.items[*].metadata.name}',
    ]);
  });

  it('returns the deployment names split on whitespace', async () => {
    ansibleService.execute.mockResolvedValue({
      ...SUCCESS,
      stdout: debugOutput('api web   worker\n'),
    });

    await expect(service.listDeployments(dto)).resolves.toEqual([
      'api',
      'web',
      'worker',
    ]);
  });

  it('returns an empty list for an empty message', async () => {
    ansibleService.execute.mockResolvedValue({
      ...SUCCESS,
      stdout: debugOutput(''),
    });

    await expect(service.listDeployments(dto)).resolves.toEqual([]);
  });

  it('does not write any operations log', async () => {
    ansibleService.execute.mockResolvedValue({
      ...SUCCESS,
      stdout: debugOutput('api'),
    });

    await service.listDeployments(dto);

    expect(await repository.count()).toBe(0);
  });

  it('fails with 502 and the failure detail of ansible when the playbook fails', async () => {
    ansibleService.execute.mockResolvedValue({
      ...FAILURE,
      stdout: '"msg": "non-zero return code", "stderr": "namespace not found"',
    });

    const attempt = service.listDeployments(dto);

    await expect(attempt).rejects.toThrow(BadGatewayException);
    await expect(attempt).rejects.toThrow(
      'Failed to list deployments: namespace not found',
    );
  });

  it('falls back to the process stderr when stdout has no detail', async () => {
    ansibleService.execute.mockResolvedValue({
      ...FAILURE,
      stdout: 'nothing',
      stderr: 'ssh: connection refused',
    });

    await expect(service.listDeployments(dto)).rejects.toThrow(
      'Failed to list deployments: ssh: connection refused',
    );
  });

  it('falls back to the error message when there is no stderr', async () => {
    ansibleService.execute.mockResolvedValue({
      ...FAILURE,
      stdout: '',
      stderr: '',
      errorMessage: 'timed out',
    });

    await expect(service.listDeployments(dto)).rejects.toThrow(
      'Failed to list deployments: timed out',
    );
  });

  it('falls back to "unknown error" when there is no detail at all', async () => {
    ansibleService.execute.mockResolvedValue({
      success: false,
      stdout: '',
      stderr: '',
      exitCode: 1,
    });

    await expect(service.listDeployments(dto)).rejects.toThrow(
      'Failed to list deployments: unknown error',
    );
  });

  it('fails with 502 when a successful run has no debug message', async () => {
    ansibleService.execute.mockResolvedValue({ ...SUCCESS, stdout: 'RECAP' });

    const attempt = service.listDeployments(dto);

    await expect(attempt).rejects.toThrow(BadGatewayException);
    await expect(attempt).rejects.toThrow(/^Failed to list deployments$/);
  });

  it('propagates errors thrown by the ansible service', async () => {
    ansibleService.execute.mockRejectedValue(new Error('spawn failed'));

    await expect(service.listDeployments(dto)).rejects.toThrow('spawn failed');
  });
});
