import { Module } from '@nestjs/common';
import { AnsibleConnector } from './ansible.connector';
import { AnsibleService } from './ansible.service';

@Module({
  providers: [AnsibleConnector, AnsibleService],
  exports: [AnsibleConnector, AnsibleService],
})
export class AnsibleModule {}
