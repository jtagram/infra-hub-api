import { AnsibleExecutionResult } from '../ansible/ansible.service';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
  InfrastructureOperationsLogEntityBuilder,
} from '../../common/database/infrastructure-operatios-log.entity';
import { ManageServerDto } from './server-hub-api.dto';

export class ServerHubApiMapper {
  static toOperationsLogEntity(
    dto: ManageServerDto,
    result: AnsibleExecutionResult,
  ): InfrastructureOperationsLogEntity {
    return new InfrastructureOperationsLogEntityBuilder()
      .withDepartment(InfrastructureDepartment.SERVER)
      .withNumberOfTicket(dto.numberOfTickets)
      .withInstruction(JSON.stringify({ playbook: dto.playbook }))
      .withResponse(JSON.stringify(result))
      .build();
  }
}
