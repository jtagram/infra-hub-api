import { Body, Controller, Post } from '@nestjs/common';
import { OperationResult } from '../../common/dto/operation-result.dto';
import { KubernetesHubApiService } from './kubernates-hub-api.service';
import {
  ManageKubernetesDto,
  ManageKubernetesServerDto,
} from './kubernates-hub-api.dto';

@Controller('kubernates-hub-api')
export class KubernetesHubApiController {
  constructor(
    private readonly kubernetesHubApiService: KubernetesHubApiService,
  ) {}

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
