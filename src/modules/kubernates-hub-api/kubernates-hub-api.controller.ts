import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { OperationResult } from '../../common/dto/operation-result.dto';
import { KubernetesHubApiService } from './kubernates-hub-api.service';
import {
  ListDeploymentsDto,
  ManageKubernetesDto,
  ManageKubernetesServerDto,
} from './kubernates-hub-api.dto';

@Controller('kubernates-hub-api')
export class KubernetesHubApiController {
  constructor(
    private readonly kubernetesHubApiService: KubernetesHubApiService,
  ) {}

  @Get('list-deployments')
  async listDeployments(
    @Query() dto: ListDeploymentsDto,
  ): Promise<{ deployments: string[] }> {
    const deployments = await this.kubernetesHubApiService.listDeployments(dto);
    return { deployments };
  }

  @Post('manage-manifest')
  async manageKubernatesManifest(
    @Body() dto: ManageKubernetesDto,
  ): Promise<OperationResult> {
    return this.kubernetesHubApiService.manageKubernatesManifest(dto);
  }

  @Post('manage-server')
  async manageKubernetesServer(
    @Body() dto: ManageKubernetesServerDto,
  ): Promise<OperationResult> {
    return this.kubernetesHubApiService.manageKubernetesServer(dto);
  }
}
