import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnvModule } from './common/config/env.module';
import { DatabaseModule } from './common/database/database.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtPublicKeyModule } from './common/jwt/jwt-public-key.module';
import { LoggerModule } from './instrument/logger/logger.module';
import { AnsibleModule } from './modules/ansible/ansible.module';
import { DatabaseHubApiModule } from './modules/database-hub-api/database-hub-api.module';
import { KubernetesHubApiModule } from './modules/kubernates-hub-api/kubernates-hub-api.module';
import { ServerHubApiModule } from './modules/server-hub-api/server-hub-api.module';

const jwtModule = JwtModule.register({});

@Module({
  imports: [
    EnvModule,
    LoggerModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    jwtModule,
    JwtPublicKeyModule,
    AnsibleModule,
    DatabaseHubApiModule,
    KubernetesHubApiModule,
    ServerHubApiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
