import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnvModule } from './common/config/env.module';
import { LoggerModule } from './instrument/logger/logger.module';
import { AnsibleModule } from './modules/ansible/ansible.module';

@Module({
  imports: [EnvModule, LoggerModule, AnsibleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
