import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { OperationResult } from '../../common/dto/operation-result.dto';
import { Roles } from '../../common/guards/roles.decorator';
import { Role } from '../../common/roles/role.enum';
import { KubernetesHubApiService } from './kubernates-hub-api.service';
import {
  ExecuteKubectlCommandDto,
  ListDeploymentsDto,
  ManageKubernetesDto,
} from './kubernates-hub-api.dto';

@Controller('kubernates-hub-api')
export class KubernetesHubApiController {
  constructor(
    private readonly kubernetesHubApiService: KubernetesHubApiService,
  ) {}

  @Get('list-deployments')
  @Roles(Role.ADMIN)
  async listDeployments(
    @Query() dto: ListDeploymentsDto,
  ): Promise<{ deployments: string[] }> {
    const deployments = await this.kubernetesHubApiService.listDeployments(dto);
    return { deployments };
  }

  @Post('manage-manifest')
  @Roles(Role.ADMIN)
  async manageKubernatesManifest(
    @Body() dto: ManageKubernetesDto,
  ): Promise<OperationResult> {
    return this.kubernetesHubApiService.manageKubernatesManifest(dto);
  }

  @Post('execute-kubectl')
  @Roles(Role.ADMIN)
  async executeKubectlCommand(
    @Body() dto: ExecuteKubectlCommandDto,
  ): Promise<OperationResult> {
    return this.kubernetesHubApiService.executeKubectlCommand(dto);
  }
}
