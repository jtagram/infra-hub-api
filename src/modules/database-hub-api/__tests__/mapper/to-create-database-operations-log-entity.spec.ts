import { describe, expect, it } from '@jest/globals';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
} from '../../../../common/database/infrastructure-operatios-log.entity';
import { AnsibleExecutionResult } from '../../../ansible/ansible.dto';
import { CreateDatabaseDto } from '../../database-hub-api.dto';
import { DatabaseHubApiMapper } from '../../database-hub-api.mapper';

const dto: CreateDatabaseDto = {
  numberOfTickets: 4,
  namespace: 'databases',
  deployment: 'postgres',
  dbName: 'new_db',
};
const result: AnsibleExecutionResult = {
  success: true,
  stdout: 'CREATE DATABASE',
  stderr: '',
  exitCode: 0,
};

describe('DatabaseHubApiMapper.toCreateDatabaseOperationsLogEntity', () => {
  it('builds a DATABASE log entity', () => {
    const entity = DatabaseHubApiMapper.toCreateDatabaseOperationsLogEntity(
      dto,
      result,
    );

    expect(entity).toBeInstanceOf(InfrastructureOperationsLogEntity);
    expect(entity.department).toBe(InfrastructureDepartment.DATABASE);
  });

  it('uses the ticket number of the dto', () => {
    expect(
      DatabaseHubApiMapper.toCreateDatabaseOperationsLogEntity(dto, result)
        .numberOfTicket,
    ).toBe(4);
  });

  it('stores the CREATE DATABASE statement as the instruction', () => {
    expect(
      DatabaseHubApiMapper.toCreateDatabaseOperationsLogEntity(dto, result)
        .instruction,
    ).toBe('CREATE DATABASE "new_db";');
  });

  it('stores the whole execution result as JSON in the response', () => {
    const entity = DatabaseHubApiMapper.toCreateDatabaseOperationsLogEntity(
      dto,
      result,
    );

    expect(JSON.parse(entity.response)).toEqual(result);
  });
});
