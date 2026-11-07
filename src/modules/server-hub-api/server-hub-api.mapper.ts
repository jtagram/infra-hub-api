import { AnsibleExecutionResult } from '../ansible/ansible.service';
import { OperationResult, OperationResultBuilder } from '../../common/dto/operation-result.dto';
import { ResponseBody } from '../../common/dto/response-body.dto';
import {
	InfrastructureDepartment,
	InfrastructureOperationsLogEntity,
	InfrastructureOperationsLogEntityBuilder,
} from '../../common/database/infrastructure-operatios-log.entity';
import { ManageServerDto } from './server-hub-api.dto';

const SERVER_MANAGED_MESSAGE = 'Server playbook executed';

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

	static toManageServerResponse(
		result: AnsibleExecutionResult,
		logId: string,
	): ResponseBody<OperationResult> {
		return ResponseBody.success(
			SERVER_MANAGED_MESSAGE,
			new OperationResultBuilder().withExecutionResult(result).withLogId(logId).build(),
		);
	}
}
