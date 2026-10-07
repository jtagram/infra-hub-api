import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RequestMethod } from '@nestjs/common';
import { OperationResult } from '../../../../common/dto/operation-result.dto';
import { ROLES_KEY } from '../../../../common/guards/roles.decorator';
import { Role } from '../../../../common/roles/role.enum';
import { ServerHubApiController } from '../../server-hub-api.controller';
import { ManageServerDto } from '../../server-hub-api.dto';
import { ServerHubApiService } from '../../server-hub-api.service';

// @nestjs/typeorm and @nestjs/config are ESM-only and Jest runs as CommonJS.
// The controller is built by hand, so the injection decorator can be a no-op.
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));

describe('ServerHubApiController.manageServer', () => {
  let service: {
    manageServer: jest.Mock<(dto: ManageServerDto) => Promise<OperationResult>>;
  };
  let controller: ServerHubApiController;
  const handler = ServerHubApiController.prototype.manageServer;
  const dto: ManageServerDto = {
    numberOfTickets: 1,
    playbook: '- hosts: all\n  tasks: []\n',
  };

  beforeEach(() => {
    service = {
      manageServer:
        jest.fn<(dto: ManageServerDto) => Promise<OperationResult>>(),
    };
    controller = new ServerHubApiController(
      service as unknown as ServerHubApiService,
    );
  });

  it('is mounted at POST /server-hub-api/manage-server', () => {
    expect(Reflect.getMetadata('path', ServerHubApiController)).toBe(
      'server-hub-api',
    );
    expect(Reflect.getMetadata('path', handler)).toBe('manage-server');
    expect(Reflect.getMetadata('method', handler)).toBe(RequestMethod.POST);
  });

  it('requires the ADMIN role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.ADMIN]);
  });

  it('binds the body to ManageServerDto', () => {
    expect(
      Reflect.getMetadata(
        'design:paramtypes',
        ServerHubApiController.prototype,
        'manageServer',
      ),
    ).toEqual([ManageServerDto]);
    const args = Reflect.getMetadata(
      '__routeArguments__',
      ServerHubApiController,
      'manageServer',
    ) as Record<string, unknown>;
    expect(Object.keys(args)).toEqual(['3:0']);
  });

  it('delegates to the service and returns its result untouched', async () => {
    const result = {
      executionResult: { success: true, stdout: '', stderr: '', exitCode: 0 },
      logId: 'log-1',
    };
    service.manageServer.mockResolvedValue(result);

    await expect(controller.manageServer(dto)).resolves.toBe(result);

    expect(service.manageServer).toHaveBeenCalledWith(dto);
  });

  it('propagates the service errors', async () => {
    service.manageServer.mockRejectedValue(new Error('boom'));

    await expect(controller.manageServer(dto)).rejects.toThrow('boom');
  });
});
