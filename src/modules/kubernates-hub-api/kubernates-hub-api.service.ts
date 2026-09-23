import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InfrastructureOperationsLogEntity } from '../../common/database/infrastructure-operatios-log.entity';
import { AnsibleService } from '../ansible/ansible.service';
import {
  KubernetesOperationResult,
  KubernetesOperationResultBuilder,
  ManageKubernetesDto,
} from './kubernates-hub-api.dto';
import { KubernetesHubApiMapper } from './kubernates-hub-api.mapper';
import { buildKubernetesManifestPlaybook } from './kubernates-hub-api.playbook';

@Injectable()
export class KubernetesHubApiService {
  constructor(
    private readonly ansibleService: AnsibleService,
    @InjectRepository(InfrastructureOperationsLogEntity)
    private readonly operationsLogRepository: Repository<InfrastructureOperationsLogEntity>,
  ) {}

  async manageKubernetes(
    dto: ManageKubernetesDto,
  ): Promise<KubernetesOperationResult> {
    const playbook = buildKubernetesManifestPlaybook(
      KubernetesHubApiMapper.toKubernetesManifestPlaybookInput(dto),
    );

    const result = await this.ansibleService.execute(playbook);

    const log = await this.operationsLogRepository.save(
      KubernetesHubApiMapper.toOperationsLogEntity(dto, result),
    );

    return new KubernetesOperationResultBuilder()
      .withExecutionResult(result)
      .withLogId(log.id)
      .build();
  }
}
