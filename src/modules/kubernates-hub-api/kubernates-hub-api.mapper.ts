import { AnsibleExecutionResult } from '../ansible/ansible.service';
import {
  InfrastructureOperationsLogEntity,
  InfrastructureOperationsLogEntityBuilder,
} from '../../common/database/infrastructure-operatios-log.entity';
import { ManageKubernetesDto } from './kubernates-hub-api.dto';
import {
  KubernetesManifestPlaybookInput,
  KubernetesManifestPlaybookInputBuilder,
} from './kubernates-hub-api.playbook';

export class KubernetesHubApiMapper {
  static toKubernetesManifestPlaybookInput(
    dto: ManageKubernetesDto,
  ): KubernetesManifestPlaybookInput {
    return new KubernetesManifestPlaybookInputBuilder()
      .withNamespace(dto.namespace)
      .withAction(dto.action)
      .withManifest(dto.manifest)
      .build();
  }

  static toOperationsLogEntity(
    dto: ManageKubernetesDto,
    result: AnsibleExecutionResult,
  ): InfrastructureOperationsLogEntity {
    return new InfrastructureOperationsLogEntityBuilder()
      .withDepartment(dto.department)
      .withNumberOfTicket(dto.numberOfTickets)
      .withInstruction(
        JSON.stringify({ action: dto.action, manifest: dto.manifest }),
      )
      .withResponse(JSON.stringify(result))
      .build();
  }
}
