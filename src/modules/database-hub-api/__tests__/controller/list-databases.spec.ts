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

describe('DatabaseHubApiController.listDatabases', () => {
  let service: {
    listDatabases: jest.Mock<(dto: ListDatabasesDto) => Promise<string[]>>;
  };
  let controller: DatabaseHubApiController;
  const handler = DatabaseHubApiController.prototype.listDatabases;

  beforeEach(() => {
    service = {
      listDatabases: jest.fn<(dto: ListDatabasesDto) => Promise<string[]>>(),
    };
    controller = new DatabaseHubApiController(
      service as unknown as DatabaseHubApiService,
    );
  });

  it('is mounted at GET /database-hub-api/list-databases', () => {
    expect(Reflect.getMetadata('path', DatabaseHubApiController)).toBe(
      'database-hub-api',
    );
    expect(Reflect.getMetadata('path', handler)).toBe('list-databases');
    expect(Reflect.getMetadata('method', handler)).toBe(RequestMethod.GET);
  });

  it('requires the ADMIN role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.ADMIN]);
  });

  it('binds the query string to ListDatabasesDto', () => {
    expect(
      Reflect.getMetadata(
        'design:paramtypes',
        DatabaseHubApiController.prototype,
        'listDatabases',
      ),
    ).toEqual([ListDatabasesDto]);
    const args = Reflect.getMetadata(
      '__routeArguments__',
      DatabaseHubApiController,
      'listDatabases',
    ) as Record<string, unknown>;
    expect(Object.keys(args)).toEqual([expect.stringMatching(/^4:0$/)]);
  });

  it('delegates to the service and wraps the names in { databases }', async () => {
    service.listDatabases.mockResolvedValue(['postgres', 'app']);
    const dto = { namespace: 'databases', deployment: 'postgres' };

    await expect(controller.listDatabases(dto)).resolves.toEqual({
      databases: ['postgres', 'app'],
    });

    expect(service.listDatabases).toHaveBeenCalledWith(dto);
  });

  it('returns an empty list when there are no databases', async () => {
    service.listDatabases.mockResolvedValue([]);

    await expect(
      controller.listDatabases({ namespace: 'n', deployment: 'd' }),
    ).resolves.toEqual({ databases: [] });
  });

  it('propagates the service errors', async () => {
    service.listDatabases.mockRejectedValue(new Error('bad gateway'));

    await expect(
      controller.listDatabases({ namespace: 'n', deployment: 'd' }),
    ).rejects.toThrow('bad gateway');
  });
});
