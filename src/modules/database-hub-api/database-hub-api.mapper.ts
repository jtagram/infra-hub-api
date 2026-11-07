import { AnsibleExecutionResult } from '../ansible/ansible.service';
import { OperationResult, OperationResultBuilder } from '../../common/dto/operation-result.dto';
import { ResponseBody } from '../../common/dto/response-body.dto';
import {
	InfrastructureDepartment,
	InfrastructureOperationsLogEntity,
	InfrastructureOperationsLogEntityBuilder,
} from '../../common/database/infrastructure-operatios-log.entity';
import {
	CreateDatabaseDto,
	ListDatabasesResponse,
	ManageDatabaseDto,
} from './database-hub-api.dto';
import {
	PostgresSqlPlaybookInput,
	PostgresSqlPlaybookInputBuilder,
} from './database-hub-api.playbook';

const DATABASES_RETRIEVED_MESSAGE = 'Databases retrieved successfully';
const DATABASE_MANAGED_MESSAGE = 'Database operation executed';
const DATABASE_CREATED_MESSAGE = 'Database creation executed';

export class DatabaseHubApiMapper {
	static toPostgresSqlPlaybookInput(dto: ManageDatabaseDto): PostgresSqlPlaybookInput {
		return new PostgresSqlPlaybookInputBuilder()
			.withNamespace(dto.namespace)
			.withDeployment(dto.deployment)
			.withDbName(dto.dbName)
			.withSqlCode(dto.sqlCode)
			.build();
	}

	static toOperationsLogEntity(
		dto: ManageDatabaseDto,
		result: AnsibleExecutionResult,
	): InfrastructureOperationsLogEntity {
		return new InfrastructureOperationsLogEntityBuilder()
			.withDepartment(InfrastructureDepartment.DATABASE)
			.withNumberOfTicket(dto.numberOfTickets)
			.withInstruction(dto.sqlCode)
			.withResponse(JSON.stringify(result))
			.build();
	}

	static toCreateDatabaseOperationsLogEntity(
		dto: CreateDatabaseDto,
		result: AnsibleExecutionResult,
	): InfrastructureOperationsLogEntity {
		return new InfrastructureOperationsLogEntityBuilder()
			.withDepartment(InfrastructureDepartment.DATABASE)
			.withNumberOfTicket(dto.numberOfTickets)
			.withInstruction(`CREATE DATABASE "${dto.dbName}";`)
			.withResponse(JSON.stringify(result))
			.build();
	}

	static toListDatabasesResponse(databases: string[]): ResponseBody<ListDatabasesResponse> {
		return ResponseBody.success(DATABASES_RETRIEVED_MESSAGE, { databases });
	}

	static toManageDatabaseResponse(
		result: AnsibleExecutionResult,
		logId: string,
	): ResponseBody<OperationResult> {
		return ResponseBody.success(DATABASE_MANAGED_MESSAGE, toOperationResult(result, logId));
	}

	static toCreateDatabaseResponse(
		result: AnsibleExecutionResult,
		logId: string,
	): ResponseBody<OperationResult> {
		return ResponseBody.success(DATABASE_CREATED_MESSAGE, toOperationResult(result, logId));
	}
}

function toOperationResult(result: AnsibleExecutionResult, logId: string): OperationResult {
	return new OperationResultBuilder().withExecutionResult(result).withLogId(logId).build();
}
