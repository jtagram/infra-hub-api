import { AnsibleExecutionResult } from '../ansible/ansible.service';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
  InfrastructureOperationsLogEntityBuilder,
} from '../../common/database/infrastructure-operatios-log.entity';
import {
  ExecuteKubectlCommandDto,
  ManageKubernetesDto,
} from './kubernates-hub-api.dto';
import {
  KubectlCommandPlaybookInput,
  KubectlCommandPlaybookInputBuilder,
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
      .withDepartment(InfrastructureDepartment.KUBERNETES)
      .withNumberOfTicket(dto.numberOfTickets)
      .withInstruction(
        JSON.stringify({ action: dto.action, manifest: dto.manifest }),
      )
      .withResponse(JSON.stringify(result))
      .build();
  }

  static toKubectlCommandPlaybookInput(
    dto: ExecuteKubectlCommandDto,
  ): KubectlCommandPlaybookInput {
    return new KubectlCommandPlaybookInputBuilder()
      .withKubectlCommand(dto.kubectlCommand)
      .build();
  }

  static toKubectlCommandOperationsLogEntity(
    dto: ExecuteKubectlCommandDto,
    result: AnsibleExecutionResult,
  ): InfrastructureOperationsLogEntity {
    return new InfrastructureOperationsLogEntityBuilder()
      .withDepartment(InfrastructureDepartment.KUBERNETES)
      .withNumberOfTicket(dto.numberOfTickets)
      .withInstruction(JSON.stringify({ kubectlCommand: dto.kubectlCommand }))
      .withResponse(JSON.stringify(result))
      .build();
  }
}
