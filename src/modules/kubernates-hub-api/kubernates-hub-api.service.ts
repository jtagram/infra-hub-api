import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InfrastructureOperationsLogEntity } from '../../common/database/infrastructure-operatios-log.entity';
import {
  OperationResult,
  OperationResultBuilder,
} from '../../common/dto/operation-result.dto';
import { AnsibleService } from '../ansible/ansible.service';
import {
  ManageKubernetesDto,
  ManageKubernetesServerDto,
} from './kubernates-hub-api.dto';
import { KubernetesHubApiMapper } from './kubernates-hub-api.mapper';
import {
  buildKubernetesManifestPlaybook,
  buildKubernetesServerCommandPlaybook,
} from './kubernates-hub-api.playbook';

@Injectable()
export class KubernetesHubApiService {
  constructor(
    private readonly ansibleService: AnsibleService,
    @InjectRepository(InfrastructureOperationsLogEntity)
    private readonly operationsLogRepository: Repository<InfrastructureOperationsLogEntity>,
  ) {}

  async manageKubernatesManifest(
    dto: ManageKubernetesDto,
  ): Promise<OperationResult> {
    const playbook = buildKubernetesManifestPlaybook(
      KubernetesHubApiMapper.toKubernetesManifestPlaybookInput(dto),
    );

    const result = await this.ansibleService.execute(playbook);

    const log = await this.operationsLogRepository.save(
      KubernetesHubApiMapper.toOperationsLogEntity(dto, result),
    );

    return new OperationResultBuilder()
      .withExecutionResult(result)
      .withLogId(log.id)
      .build();
  }

  async manageKubernetesServer(
    dto: ManageKubernetesServerDto,
  ): Promise<OperationResult> {
    const playbook = buildKubernetesServerCommandPlaybook(
      KubernetesHubApiMapper.toKubernetesServerCommandPlaybookInput(dto),
    );

    const result = await this.ansibleService.execute(playbook);

    const log = await this.operationsLogRepository.save(
      KubernetesHubApiMapper.toServerOperationsLogEntity(dto, result),
    );

    return new OperationResultBuilder()
      .withExecutionResult(result)
      .withLogId(log.id)
      .build();
  }
}
