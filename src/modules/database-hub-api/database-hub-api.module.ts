import { Module } from '@nestjs/common';
import { AnsibleModule } from '../ansible/ansible.module';
import { DatabaseHubApiController } from './database-hub-api.controller';
import { DatabaseHubApiService } from './database-hub-api.service';

@Module({
  imports: [AnsibleModule],
  controllers: [DatabaseHubApiController],
  providers: [DatabaseHubApiService],
})
export class DatabaseHubApiModule {}
