import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OperationResult } from '../../common/dto/operation-result.dto';
import { ResponseBody } from '../../common/dto/response-body.dto';
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
	listDeployments(
		@Query() dto: ListDeploymentsDto,
	): Promise<ResponseBody<ListDeploymentsResponse>> {
		return this.kubernetesHubApiService.listDeployments(dto);
	}

	@Post('manage-manifest')
	@ApiManageManifest()
	@Roles(Role.ADMIN)
	manageKubernatesManifest(
		@Body() dto: ManageKubernetesDto,
	): Promise<ResponseBody<OperationResult>> {
		return this.kubernetesHubApiService.manageKubernatesManifest(dto);
	}

	@Post('execute-kubectl')
	@ApiExecuteKubectl()
	@Roles(Role.ADMIN)
	executeKubectlCommand(
		@Body() dto: ExecuteKubectlCommandDto,
	): Promise<ResponseBody<OperationResult>> {
		return this.kubernetesHubApiService.executeKubectlCommand(dto);
	}
}
