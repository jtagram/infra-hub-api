import { AnsibleExecutionResult } from '../ansible/ansible.service';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
  InfrastructureOperationsLogEntityBuilder,
} from '../../common/database/infrastructure-operatios-log.entity';
import { ManageServerDto } from './server-hub-api.dto';
import {
  ServerCommandPlaybookInput,
  ServerCommandPlaybookInputBuilder,
} from './server-hub-api.playbook';

export class ServerHubApiMapper {
  static toServerCommandPlaybookInput(
    dto: ManageServerDto,
  ): ServerCommandPlaybookInput {
    return new ServerCommandPlaybookInputBuilder()
      .withCommand(dto.command)
      .build();
  }

  static toOperationsLogEntity(
    dto: ManageServerDto,
    result: AnsibleExecutionResult,
  ): InfrastructureOperationsLogEntity {
    return new InfrastructureOperationsLogEntityBuilder()
      .withDepartment(InfrastructureDepartment.SERVER)
      .withNumberOfTicket(dto.numberOfTickets)
      .withInstruction(JSON.stringify({ command: dto.command }))
      .withResponse(JSON.stringify(result))
      .build();
  }
}
