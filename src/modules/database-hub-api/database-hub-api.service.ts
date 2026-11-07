import { BadGatewayException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InfrastructureOperationsLogEntity } from '../../common/database/infrastructure-operatios-log.entity';
import { OperationResult } from '../../common/dto/operation-result.dto';
import { ResponseBody } from '../../common/dto/response-body.dto';
import {
	extractAnsibleDebugMessage,
	extractAnsibleFailureDetail,
} from '../../common/helpers/ansible-output.helper';
import { AnsibleService } from '../ansible/ansible.service';
import {
	CreateDatabaseDto,
	ListDatabasesDto,
	ListDatabasesResponse,
	ManageDatabaseDto,
} from './database-hub-api.dto';
import { DatabaseHubApiMapper } from './database-hub-api.mapper';
import {
	buildCreateDatabasePlaybook,
	buildListDatabasesPlaybook,
	buildPostgresSqlPlaybook,
} from './database-hub-api.playbook';

const LIST_DATABASES_FAILED_MESSAGE = 'Failed to list databases';

@Injectable()
export class DatabaseHubApiService {
	constructor(
		private readonly ansibleService: AnsibleService,
		@InjectRepository(InfrastructureOperationsLogEntity)
		private readonly operationsLogRepository: Repository<InfrastructureOperationsLogEntity>,
	) {}

	async listDatabases(dto: ListDatabasesDto): Promise<ResponseBody<ListDatabasesResponse>> {
		const playbook = buildListDatabasesPlaybook(dto.namespace, dto.deployment);
		const result = await this.ansibleService.execute(playbook);

		if (!result.success) {
			const detail =
				extractAnsibleFailureDetail(result.stdout) ||
				result.stderr ||
				result.errorMessage ||
				'unknown error';
			throw new BadGatewayException(`${LIST_DATABASES_FAILED_MESSAGE}: ${detail}`);
		}

		const databaseNames = extractAnsibleDebugMessage(result.stdout);
		if (databaseNames === null) {
			throw new BadGatewayException(LIST_DATABASES_FAILED_MESSAGE);
		}

		const databases = databaseNames
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		return DatabaseHubApiMapper.toListDatabasesResponse(databases);
	}

	async manageDatabase(dto: ManageDatabaseDto): Promise<ResponseBody<OperationResult>> {
		const playbook = buildPostgresSqlPlaybook(DatabaseHubApiMapper.toPostgresSqlPlaybookInput(dto));

		const result = await this.ansibleService.execute(playbook);

		const log = await this.operationsLogRepository.save(
			DatabaseHubApiMapper.toOperationsLogEntity(dto, result),
		);

		return DatabaseHubApiMapper.toManageDatabaseResponse(result, log.id);
	}

	async createDatabase(dto: CreateDatabaseDto): Promise<ResponseBody<OperationResult>> {
		const playbook = buildCreateDatabasePlaybook(dto.namespace, dto.deployment, dto.dbName);

		const result = await this.ansibleService.execute(playbook);

		const log = await this.operationsLogRepository.save(
			DatabaseHubApiMapper.toCreateDatabaseOperationsLogEntity(dto, result),
		);

		return DatabaseHubApiMapper.toCreateDatabaseResponse(result, log.id);
	}
}
