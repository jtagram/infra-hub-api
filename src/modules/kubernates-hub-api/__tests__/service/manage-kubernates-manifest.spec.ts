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

describe('KubernetesHubApiService.manageKubernatesManifest (in-memory db)', () => {
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

  const dto = {
    numberOfTickets: 55,
    namespace: 'prod',
    action: KubernetesAction.APPLY,
    manifest: 'kind: Pod',
  };

  it('executes a kubectl playbook with the manifest on stdin', async () => {
    await service.manageKubernatesManifest(dto);

    const [task] = tasksOf(ansibleService.execute.mock.calls[0][0]);
    expect(task['ansible.builtin.command']).toEqual({
      argv: ['microk8s', 'kubectl', 'apply', '-n', 'prod', '-f', '-'],
      stdin: 'kind: Pod',
    });
  });

  it('persists a KUBERNETES log with action, manifest, ticket and execution result', async () => {
    await service.manageKubernatesManifest(dto);

    const [log] = await repository.find();
    expect(log.department).toBe(InfrastructureDepartment.KUBERNETES);
    expect(log.numberOfTicket).toBe(55);
    expect(JSON.parse(log.instruction)).toEqual({
      action: 'apply',
      manifest: 'kind: Pod',
    });
    expect(JSON.parse(log.response)).toEqual(SUCCESS);
  });

  it('returns the execution result and the id of the persisted log', async () => {
    const result = await service.manageKubernatesManifest(dto);

    const [log] = await repository.find();
    expect(result.executionResult).toEqual(SUCCESS);
    expect(result.logId).toBe(log.id);
  });

  it('logs and returns a failed execution too', async () => {
    ansibleService.execute.mockResolvedValue(FAILURE);

    const result = await service.manageKubernatesManifest(dto);

    expect(result.executionResult).toEqual(FAILURE);
    expect(await repository.count()).toBe(1);
  });

  it('does not log anything when the ansible execution throws', async () => {
    ansibleService.execute.mockRejectedValue(new Error('spawn failed'));

    await expect(service.manageKubernatesManifest(dto)).rejects.toThrow(
      'spawn failed',
    );

    expect(await repository.count()).toBe(0);
  });

  it('fails when the log cannot be saved even though kubectl already ran', async () => {
    jest.spyOn(repository, 'save').mockRejectedValue(new Error('db down'));

    await expect(service.manageKubernatesManifest(dto)).rejects.toThrow(
      'db down',
    );

    expect(ansibleService.execute).toHaveBeenCalledTimes(1);
  });
});
