import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InfrastructureOperationsLogEntity } from '../../common/database/infrastructure-operatios-log.entity';
import {
  OperationResult,
  OperationResultBuilder,
} from '../../common/dto/operation-result.dto';
import { AnsibleService } from '../ansible/ansible.service';
import { ManageServerDto } from './server-hub-api.dto';
import { ServerHubApiMapper } from './server-hub-api.mapper';
import { buildServerCommandPlaybook } from './server-hub-api.playbook';

@Injectable()
export class ServerHubApiService {
  constructor(
    private readonly ansibleService: AnsibleService,
    @InjectRepository(InfrastructureOperationsLogEntity)
    private readonly operationsLogRepository: Repository<InfrastructureOperationsLogEntity>,
  ) {}

  async manageServer(dto: ManageServerDto): Promise<OperationResult> {
    const playbook = buildServerCommandPlaybook(
      ServerHubApiMapper.toServerCommandPlaybookInput(dto),
    );

    const result = await this.ansibleService.execute(playbook);

    const log = await this.operationsLogRepository.save(
      ServerHubApiMapper.toOperationsLogEntity(dto, result),
    );

    return new OperationResultBuilder()
      .withExecutionResult(result)
      .withLogId(log.id)
      .build();
  }
}
