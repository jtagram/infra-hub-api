import { describe, expect, it } from '@jest/globals';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
} from '../../../../common/database/infrastructure-operatios-log.entity';
import { AnsibleExecutionResult } from '../../../ansible/ansible.dto';
import { ManageServerDto } from '../../server-hub-api.dto';
import { ServerHubApiMapper } from '../../server-hub-api.mapper';

const dto: ManageServerDto = {
  numberOfTickets: 12,
  playbook: '- hosts: all\n  tasks: []\n',
};
const result: AnsibleExecutionResult = {
  success: false,
  stdout: 'fatal',
  stderr: 'err',
  exitCode: 4,
  errorMessage: 'failed',
  errorCode: 4,
};

describe('ServerHubApiMapper.toOperationsLogEntity', () => {
  it('builds a SERVER log entity', () => {
    const entity = ServerHubApiMapper.toOperationsLogEntity(dto, result);

    expect(entity).toBeInstanceOf(InfrastructureOperationsLogEntity);
    expect(entity.department).toBe(InfrastructureDepartment.SERVER);
  });

  it('uses the ticket number of the dto', () => {
    expect(
      ServerHubApiMapper.toOperationsLogEntity(dto, result).numberOfTicket,
    ).toBe(12);
  });

  it('stores the playbook as JSON in the instruction', () => {
    const entity = ServerHubApiMapper.toOperationsLogEntity(dto, result);

    expect(JSON.parse(entity.instruction)).toEqual({
      playbook: '- hosts: all\n  tasks: []\n',
    });
  });

  it('stores the whole execution result as JSON in the response', () => {
    const entity = ServerHubApiMapper.toOperationsLogEntity(dto, result);

    expect(JSON.parse(entity.response)).toEqual(result);
  });
});
