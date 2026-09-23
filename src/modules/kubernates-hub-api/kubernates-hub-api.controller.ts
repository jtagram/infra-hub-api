import { Body, Controller, Post } from '@nestjs/common';
import { KubernetesHubApiService } from './kubernates-hub-api.service';
import {
  KubernetesOperationResult,
  ManageKubernetesDto,
  ManageKubernetesServerDto,
} from './kubernates-hub-api.dto';

@Controller('kubernates-hub-api')
export class KubernetesHubApiController {
  constructor(
    private readonly kubernetesHubApiService: KubernetesHubApiService,
  ) {}

  @Post('kubernate-manifest')
  async manageKubernetes(
    @Body() dto: ManageKubernetesDto,
  ): Promise<KubernetesOperationResult> {
    return this.kubernetesHubApiService.manageKubernetes(dto);
  }

  @Post('kubernetes-server')
  async manageKubernetesServer(
    @Body() dto: ManageKubernetesServerDto,
  ): Promise<KubernetesOperationResult> {
    return this.kubernetesHubApiService.manageKubernetesServer(dto);
  }
}
