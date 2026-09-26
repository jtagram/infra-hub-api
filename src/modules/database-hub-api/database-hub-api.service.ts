import { BadGatewayException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InfrastructureOperationsLogEntity } from '../../common/database/infrastructure-operatios-log.entity';
import {
  OperationResult,
  OperationResultBuilder,
} from '../../common/dto/operation-result.dto';
import { AnsibleService } from '../ansible/ansible.service';
import {
  CreateDatabaseDto,
  ListDatabasesDto,
  ManageDatabaseDto,
} from './database-hub-api.dto';
import { DatabaseHubApiMapper } from './database-hub-api.mapper';
import {
  buildCreateDatabasePlaybook,
  buildListDatabasesPlaybook,
  buildPostgresSqlPlaybook,
} from './database-hub-api.playbook';

const LIST_DATABASES_FAILED_MESSAGE = 'Failed to list databases';

@Injectable()
export class DatabaseHubApiService {
  constructor(
    private readonly ansibleService: AnsibleService,
    @InjectRepository(InfrastructureOperationsLogEntity)
    private readonly operationsLogRepository: Repository<InfrastructureOperationsLogEntity>,
  ) {}

  async listDatabases(dto: ListDatabasesDto): Promise<string[]> {
    const playbook = buildListDatabasesPlaybook(dto.namespace, dto.deployment);
    const result = await this.ansibleService.execute(playbook);

    if (!result.success) {
      throw new BadGatewayException(LIST_DATABASES_FAILED_MESSAGE);
    }

    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  async manageDatabase(dto: ManageDatabaseDto): Promise<OperationResult> {
    const playbook = buildPostgresSqlPlaybook(
      DatabaseHubApiMapper.toPostgresSqlPlaybookInput(dto),
    );

    const result = await this.ansibleService.execute(playbook);

    const log = await this.operationsLogRepository.save(
      DatabaseHubApiMapper.toOperationsLogEntity(dto, result),
    );

    return new OperationResultBuilder()
      .withExecutionResult(result)
      .withLogId(log.id)
      .build();
  }

  async createDatabase(dto: CreateDatabaseDto): Promise<OperationResult> {
    const playbook = buildCreateDatabasePlaybook(
      dto.namespace,
      dto.deployment,
      dto.dbName,
    );

    const result = await this.ansibleService.execute(playbook);

    const log = await this.operationsLogRepository.save(
      DatabaseHubApiMapper.toCreateDatabaseOperationsLogEntity(dto, result),
    );

    return new OperationResultBuilder()
      .withExecutionResult(result)
      .withLogId(log.id)
      .build();
  }
}
