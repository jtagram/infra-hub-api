import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OperationResult } from '../../common/dto/operation-result.dto';
import { Roles } from '../../common/guards/roles.decorator';
import { Role } from '../../common/roles/role.enum';
import { KubernetesHubApiService } from './kubernates-hub-api.service';
import {
	ExecuteKubectlCommandDto,
	ListDeploymentsDto,
	ListDeploymentsResponse,
	ManageKubernetesDto,
} from './kubernates-hub-api.dto';
import {
	ApiExecuteKubectl,
	ApiListDeployments,
	ApiManageManifest,
} from './swagger/kubernates-hub-api.swagger';

@ApiTags('Kubernetes Hub')
@Controller('kubernates-hub-api')
export class KubernetesHubApiController {
	constructor(private readonly kubernetesHubApiService: KubernetesHubApiService) {}

	@Get('list-deployments')
	@ApiListDeployments()
	@Roles(Role.ADMIN)
	async listDeployments(@Query() dto: ListDeploymentsDto): Promise<ListDeploymentsResponse> {
		const deployments = await this.kubernetesHubApiService.listDeployments(dto);
		return { deployments };
	}

	@Post('manage-manifest')
	@ApiManageManifest()
	@Roles(Role.ADMIN)
	async manageKubernatesManifest(@Body() dto: ManageKubernetesDto): Promise<OperationResult> {
		return this.kubernetesHubApiService.manageKubernatesManifest(dto);
	}

	@Post('execute-kubectl')
	@ApiExecuteKubectl()
	@Roles(Role.ADMIN)
	async executeKubectlCommand(@Body() dto: ExecuteKubectlCommandDto): Promise<OperationResult> {
		return this.kubernetesHubApiService.executeKubectlCommand(dto);
	}
}
