import { BadGatewayException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InfrastructureOperationsLogEntity } from '../../common/database/infrastructure-operatios-log.entity';
import {
  OperationResult,
  OperationResultBuilder,
} from '../../common/dto/operation-result.dto';
import {
  extractAnsibleDebugMessage,
  extractAnsibleFailureDetail,
} from '../../common/helpers/ansible-output.helper';
import { AnsibleService } from '../ansible/ansible.service';
import {
  ExecuteKubectlCommandDto,
  ListDeploymentsDto,
  ManageKubernetesDto,
} from './kubernates-hub-api.dto';
import { KubernetesHubApiMapper } from './kubernates-hub-api.mapper';
import {
  buildKubectlCommandPlaybook,
  buildKubernetesManifestPlaybook,
  buildListDeploymentsPlaybook,
} from './kubernates-hub-api.playbook';

const LIST_DEPLOYMENTS_FAILED_MESSAGE = 'Failed to list deployments';

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

  async listDeployments(dto: ListDeploymentsDto): Promise<string[]> {
    const playbook = buildListDeploymentsPlaybook(dto.namespace);
    const result = await this.ansibleService.execute(playbook);

    if (!result.success) {
      const detail =
        extractAnsibleFailureDetail(result.stdout) ||
        result.stderr ||
        result.errorMessage ||
        'unknown error';
      throw new BadGatewayException(`${LIST_DEPLOYMENTS_FAILED_MESSAGE}: ${detail}`);
    }

    const deploymentNames = extractAnsibleDebugMessage(result.stdout);
    if (deploymentNames === null) {
      throw new BadGatewayException(LIST_DEPLOYMENTS_FAILED_MESSAGE);
    }

    return deploymentNames
      .trim()
      .split(/\s+/)
      .filter((name) => name.length > 0);
  }

  async executeKubectlCommand(
    dto: ExecuteKubectlCommandDto,
  ): Promise<OperationResult> {
    const playbook = buildKubectlCommandPlaybook(
      KubernetesHubApiMapper.toKubectlCommandPlaybookInput(dto),
    );

    const result = await this.ansibleService.execute(playbook);

    const log = await this.operationsLogRepository.save(
      KubernetesHubApiMapper.toKubectlCommandOperationsLogEntity(dto, result),
    );

    return new OperationResultBuilder()
      .withExecutionResult(result)
      .withLogId(log.id)
      .build();
  }
}
