import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnvModule } from './common/config/env.module';
import { DatabaseModule } from './common/database/database.module';
import { LoggerModule } from './instrument/logger/logger.module';
import { AnsibleModule } from './modules/ansible/ansible.module';
import { DatabaseHubApiModule } from './modules/database-hub-api/database-hub-api.module';
import { KubernetesHubApiModule } from './modules/kubernates-hub-api/kubernates-hub-api.module';
import { ServerHubApiModule } from './modules/server-hub-api/server-hub-api.module';

@Module({
  imports: [
    EnvModule,
    DatabaseModule,
    LoggerModule,
    AnsibleModule,
    DatabaseHubApiModule,
    KubernetesHubApiModule,
    ServerHubApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
