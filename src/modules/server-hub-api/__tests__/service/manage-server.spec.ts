import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { DataSource, Repository } from 'typeorm';
import { createInMemoryDataSource } from '../../../../../test/helpers/in-memory-db';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
} from '../../../../common/database/infrastructure-operatios-log.entity';
import { AnsibleExecutionResult } from '../../../ansible/ansible.dto';
import { AnsibleService } from '../../../ansible/ansible.service';
import { ServerHubApiService } from '../../server-hub-api.service';

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
const PLAYBOOK = '- hosts: all\n  tasks:\n    - ansible.builtin.ping:\n';

describe('ServerHubApiService.manageServer (in-memory db)', () => {
  let dataSource: DataSource;
  let repository: Repository<InfrastructureOperationsLogEntity>;
  let ansibleService: {
    execute: jest.Mock<(playbook: string) => Promise<AnsibleExecutionResult>>;
  };
  let service: ServerHubApiService;
  const dto = { numberOfTickets: 88, playbook: PLAYBOOK };

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
    service = new ServerHubApiService(
      ansibleService as unknown as AnsibleService,
      repository,
    );
  });

  it('executes the playbook of the dto exactly as received', async () => {
    await service.manageServer(dto);

    expect(ansibleService.execute).toHaveBeenCalledTimes(1);
    expect(ansibleService.execute).toHaveBeenCalledWith(PLAYBOOK);
  });

  it('persists a SERVER log with the playbook, ticket and execution result', async () => {
    await service.manageServer(dto);

    const [log] = await repository.find();
    expect(log.department).toBe(InfrastructureDepartment.SERVER);
    expect(log.numberOfTicket).toBe(88);
    expect(JSON.parse(log.instruction)).toEqual({ playbook: PLAYBOOK });
    expect(JSON.parse(log.response)).toEqual(SUCCESS);
  });

  it('returns the execution result and the id of the persisted log', async () => {
    const result = await service.manageServer(dto);

    const [log] = await repository.find();
    expect(result.executionResult).toEqual(SUCCESS);
    expect(result.logId).toBe(log.id);
  });

  it('logs and returns a failed execution too', async () => {
    ansibleService.execute.mockResolvedValue(FAILURE);

    const result = await service.manageServer(dto);

    expect(result.executionResult).toEqual(FAILURE);
    expect(await repository.count()).toBe(1);
  });

  it('does not log anything when the playbook is rejected or cannot run', async () => {
    ansibleService.execute.mockRejectedValue(
      new Error('Invalid Ansible playbook: expected a YAML list of plays'),
    );

    await expect(service.manageServer(dto)).rejects.toThrow(
      'Invalid Ansible playbook',
    );

    expect(await repository.count()).toBe(0);
  });

  it('fails when the log cannot be saved even though the playbook already ran', async () => {
    jest.spyOn(repository, 'save').mockRejectedValue(new Error('db down'));

    await expect(service.manageServer(dto)).rejects.toThrow('db down');

    expect(ansibleService.execute).toHaveBeenCalledTimes(1);
  });
});
