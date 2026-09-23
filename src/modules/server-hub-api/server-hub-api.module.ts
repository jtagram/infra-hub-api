import { Module } from '@nestjs/common';
import { AnsibleModule } from '../ansible/ansible.module';
import { ServerHubApiController } from './server-hub-api.controller';
import { ServerHubApiService } from './server-hub-api.service';

@Module({
  imports: [AnsibleModule],
  controllers: [ServerHubApiController],
  providers: [ServerHubApiService],
})
export class ServerHubApiModule {}
