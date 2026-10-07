import { describe, expect, it } from '@jest/globals';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
} from '../../../../common/database/infrastructure-operatios-log.entity';
import { AnsibleExecutionResult } from '../../../ansible/ansible.dto';
import { ManageDatabaseDto } from '../../database-hub-api.dto';
import { DatabaseHubApiMapper } from '../../database-hub-api.mapper';

const dto: ManageDatabaseDto = {
  numberOfTickets: 9,
  namespace: 'databases',
  deployment: 'postgres',
  dbName: 'app',
  sqlCode: 'UPDATE t SET a = 1;',
};
const result: AnsibleExecutionResult = {
  success: false,
  stdout: 'fatal',
  stderr: 'err',
  exitCode: 2,
  errorMessage: 'failed',
  errorCode: 2,
};

describe('DatabaseHubApiMapper.toOperationsLogEntity', () => {
  it('builds a DATABASE log entity', () => {
    const entity = DatabaseHubApiMapper.toOperationsLogEntity(dto, result);

    expect(entity).toBeInstanceOf(InfrastructureOperationsLogEntity);
    expect(entity.department).toBe(InfrastructureDepartment.DATABASE);
  });

  it('uses the ticket number of the dto', () => {
    expect(
      DatabaseHubApiMapper.toOperationsLogEntity(dto, result).numberOfTicket,
    ).toBe(9);
  });

  it('stores the raw sqlCode as the instruction', () => {
    expect(
      DatabaseHubApiMapper.toOperationsLogEntity(dto, result).instruction,
    ).toBe('UPDATE t SET a = 1;');
  });

  it('stores the whole execution result as JSON in the response', () => {
    const entity = DatabaseHubApiMapper.toOperationsLogEntity(dto, result);

    expect(JSON.parse(entity.response)).toEqual(result);
  });

  it('does not set generated fields', () => {
    const entity = DatabaseHubApiMapper.toOperationsLogEntity(dto, result);

    expect(entity.id).toBeUndefined();
    expect(entity.createdAt).toBeUndefined();
  });
});
