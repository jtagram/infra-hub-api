import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { load } from 'js-yaml';
import { DataSource, Repository } from 'typeorm';
import { createInMemoryDataSource } from '../../../../../test/helpers/in-memory-db';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
} from '../../../../common/database/infrastructure-operatios-log.entity';
import { AnsibleExecutionResult } from '../../../ansible/ansible.dto';
import { AnsibleService } from '../../../ansible/ansible.service';
import { DatabaseHubApiService } from '../../database-hub-api.service';

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

describe('DatabaseHubApiService.createDatabase (in-memory db)', () => {
  const dto = {
    numberOfTickets: 31,
    namespace: 'databases',
    deployment: 'postgres',
    dbName: 'new_db',
  };

  let dataSource: DataSource;
  let repository: Repository<InfrastructureOperationsLogEntity>;
  let ansibleService: {
    execute: jest.Mock<(playbook: string) => Promise<AnsibleExecutionResult>>;
  };
  let service: DatabaseHubApiService;

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
    service = new DatabaseHubApiService(
      ansibleService as unknown as AnsibleService,
      repository,
    );
  });

  it('executes a CREATE DATABASE playbook against the administration database', async () => {
    await service.createDatabase(dto);

    const argv = (
      load(ansibleService.execute.mock.calls[0][0]) as {
        tasks: { 'ansible.builtin.command': { argv: string[] } }[];
      }[]
    )[0].tasks[0]['ansible.builtin.command'].argv;
    expect(argv[argv.indexOf('-d') + 1]).toBe('postgres');
    expect(argv[argv.length - 1]).toBe('CREATE DATABASE "new_db";');
    expect(argv[3]).toBe('deploy/postgres');
  });

  it('persists a DATABASE log with the statement, ticket and execution result', async () => {
    await service.createDatabase(dto);

    const [log] = await repository.find();
    expect(log.department).toBe(InfrastructureDepartment.DATABASE);
    expect(log.numberOfTicket).toBe(31);
    expect(log.instruction).toBe('CREATE DATABASE "new_db";');
    expect(JSON.parse(log.response)).toEqual(SUCCESS);
  });

  it('returns the execution result and the id of the persisted log', async () => {
    const result = await service.createDatabase(dto);

    const [log] = await repository.find();
    expect(result.executionResult).toEqual(SUCCESS);
    expect(result.logId).toBe(log.id);
  });

  it('logs and returns a failed execution too', async () => {
    ansibleService.execute.mockResolvedValue(FAILURE);

    const result = await service.createDatabase(dto);

    expect(result.executionResult).toEqual(FAILURE);
    expect(await repository.count()).toBe(1);
  });

  it('does not log anything when the ansible execution throws', async () => {
    ansibleService.execute.mockRejectedValue(new Error('invalid playbook'));

    await expect(service.createDatabase(dto)).rejects.toThrow(
      'invalid playbook',
    );

    expect(await repository.count()).toBe(0);
  });

  it('fails when the log cannot be saved', async () => {
    jest.spyOn(repository, 'save').mockRejectedValue(new Error('db down'));

    await expect(service.createDatabase(dto)).rejects.toThrow('db down');
  });
});
