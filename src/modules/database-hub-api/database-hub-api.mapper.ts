import { AnsibleExecutionResult } from '../ansible/ansible.service';
import {
  InfrastructureOperationsLogEntity,
  InfrastructureOperationsLogEntityBuilder,
} from '../../common/database/infrastructure-operatios-log.entity';
import { ManageDatabaseDto } from './database-hub-api.dto';
import {
  PostgresSqlPlaybookInput,
  PostgresSqlPlaybookInputBuilder,
} from './database-hub-api.playbook';

export class DatabaseHubApiMapper {
  static toPostgresSqlPlaybookInput(
    dto: ManageDatabaseDto,
  ): PostgresSqlPlaybookInput {
    return new PostgresSqlPlaybookInputBuilder()
      .withNamespace(dto.namespace)
      .withDbName(dto.dbName)
      .withSqlCode(dto.sqlCode)
      .build();
  }

  static toOperationsLogEntity(
    dto: ManageDatabaseDto,
    result: AnsibleExecutionResult,
  ): InfrastructureOperationsLogEntity {
    return new InfrastructureOperationsLogEntityBuilder()
      .withDepartment(dto.department)
      .withNumberOfTicket(dto.numberOfTickets)
      .withInstruction(dto.sqlCode)
      .withResponse(JSON.stringify(result))
      .build();
  }
}
