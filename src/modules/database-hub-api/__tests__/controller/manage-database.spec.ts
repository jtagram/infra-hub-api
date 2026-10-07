import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RequestMethod } from '@nestjs/common';
import { OperationResult } from '../../../../common/dto/operation-result.dto';
import { ROLES_KEY } from '../../../../common/guards/roles.decorator';
import { Role } from '../../../../common/roles/role.enum';
import { DatabaseHubApiController } from '../../database-hub-api.controller';
import {
  CreateDatabaseDto,
  ListDatabasesDto,
  ManageDatabaseDto,
} from '../../database-hub-api.dto';
import { DatabaseHubApiService } from '../../database-hub-api.service';

// @nestjs/typeorm and @nestjs/config are ESM-only and Jest runs as CommonJS.
// The controller is built by hand, so the injection decorator can be a no-op.
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));

describe('DatabaseHubApiController.manageDatabase', () => {
  let service: {
    manageDatabase: jest.Mock<
      (dto: ManageDatabaseDto) => Promise<OperationResult>
    >;
  };
  let controller: DatabaseHubApiController;
  const handler = DatabaseHubApiController.prototype.manageDatabase;
  const dto: ManageDatabaseDto = {
    numberOfTickets: 5,
    namespace: 'databases',
    deployment: 'postgres',
    dbName: 'app',
    sqlCode: 'SELECT 1;',
  };

  beforeEach(() => {
    service = {
      manageDatabase:
        jest.fn<(dto: ManageDatabaseDto) => Promise<OperationResult>>(),
    };
    controller = new DatabaseHubApiController(
      service as unknown as DatabaseHubApiService,
    );
  });

  it('is mounted at POST /database-hub-api/manage-database', () => {
    expect(Reflect.getMetadata('path', handler)).toBe('manage-database');
    expect(Reflect.getMetadata('method', handler)).toBe(RequestMethod.POST);
  });

  it('requires the ADMIN role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.ADMIN]);
  });

  it('binds the body to ManageDatabaseDto', () => {
    expect(
      Reflect.getMetadata(
        'design:paramtypes',
        DatabaseHubApiController.prototype,
        'manageDatabase',
      ),
    ).toEqual([ManageDatabaseDto]);
    const args = Reflect.getMetadata(
      '__routeArguments__',
      DatabaseHubApiController,
      'manageDatabase',
    ) as Record<string, unknown>;
    expect(Object.keys(args)).toEqual(['3:0']);
  });

  it('delegates to the service and returns its result untouched', async () => {
    const result = {
      executionResult: { success: true, stdout: '', stderr: '', exitCode: 0 },
      logId: 'log-1',
    };
    service.manageDatabase.mockResolvedValue(result);

    await expect(controller.manageDatabase(dto)).resolves.toBe(result);

    expect(service.manageDatabase).toHaveBeenCalledWith(dto);
  });

  it('propagates the service errors', async () => {
    service.manageDatabase.mockRejectedValue(new Error('db down'));

    await expect(controller.manageDatabase(dto)).rejects.toThrow('db down');
  });
});
