import { Module } from '@nestjs/common';
import { AnsibleModule } from '../ansible/ansible.module';
import { KubernetesHubApiController } from './kubernates-hub-api.controller';
import { KubernetesHubApiService } from './kubernates-hub-api.service';

@Module({
  imports: [AnsibleModule],
  controllers: [KubernetesHubApiController],
  providers: [KubernetesHubApiService],
})
export class KubernetesHubApiModule {}
