import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InfrastructureOperationsLogEntity } from '../../common/database/infrastructure-operatios-log.entity';
import { AnsibleService } from '../ansible/ansible.service';
import {
  DatabaseOperationResult,
  DatabaseOperationResultBuilder,
  ManageDatabaseDto,
} from './database-hub-api.dto';
import { DatabaseHubApiMapper } from './database-hub-api.mapper';
import { buildPostgresSqlPlaybook } from './database-hub-api.playbook';

@Injectable()
export class DatabaseHubApiService {
  constructor(
    private readonly ansibleService: AnsibleService,
    @InjectRepository(InfrastructureOperationsLogEntity)
    private readonly operationsLogRepository: Repository<InfrastructureOperationsLogEntity>,
  ) {}

  async manageDatabase(
    dto: ManageDatabaseDto,
  ): Promise<DatabaseOperationResult> {
    const playbook = buildPostgresSqlPlaybook(
      DatabaseHubApiMapper.toPostgresSqlPlaybookInput(dto),
    );

    const result = await this.ansibleService.execute(playbook);

    const log = await this.operationsLogRepository.save(
      DatabaseHubApiMapper.toOperationsLogEntity(dto, result),
    );

    return new DatabaseOperationResultBuilder()
      .withExecutionResult(result)
      .withLogId(log.id)
      .build();
  }
}
