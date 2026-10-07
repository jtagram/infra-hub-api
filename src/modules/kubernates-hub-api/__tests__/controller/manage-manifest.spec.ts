import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RequestMethod } from '@nestjs/common';
import { OperationResult } from '../../../../common/dto/operation-result.dto';
import { ROLES_KEY } from '../../../../common/guards/roles.decorator';
import { Role } from '../../../../common/roles/role.enum';
import { KubernetesHubApiController } from '../../kubernates-hub-api.controller';
import {
  ExecuteKubectlCommandDto,
  ListDeploymentsDto,
  ManageKubernetesDto,
} from '../../kubernates-hub-api.dto';
import { KubernetesAction } from '../../kubernates-hub-api.playbook';
import { KubernetesHubApiService } from '../../kubernates-hub-api.service';

// @nestjs/typeorm and @nestjs/config are ESM-only and Jest runs as CommonJS.
// The controller is built by hand, so the injection decorator can be a no-op.
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));

describe('KubernetesHubApiController.manageKubernatesManifest', () => {
  let service: {
    manageKubernatesManifest: jest.Mock<
      (dto: ManageKubernetesDto) => Promise<unknown>
    >;
  };
  let controller: KubernetesHubApiController;
  const handler = KubernetesHubApiController.prototype.manageKubernatesManifest;

  beforeEach(() => {
    service = {
      manageKubernatesManifest:
        jest.fn<(dto: ManageKubernetesDto) => Promise<unknown>>(),
    };
    controller = new KubernetesHubApiController(
      service as unknown as KubernetesHubApiService,
    );
  });

  it('is mounted at POST /kubernates-hub-api/manage-manifest', () => {
    expect(Reflect.getMetadata('path', KubernetesHubApiController)).toBe(
      'kubernates-hub-api',
    );
    expect(Reflect.getMetadata('path', handler)).toBe('manage-manifest');
    expect(Reflect.getMetadata('method', handler)).toBe(RequestMethod.POST);
  });

  it('requires the ADMIN role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.ADMIN]);
  });

  it('binds the body to ManageKubernetesDto', () => {
    expect(
      Reflect.getMetadata(
        'design:paramtypes',
        KubernetesHubApiController.prototype,
        'manageKubernatesManifest',
      ),
    ).toEqual([ManageKubernetesDto]);
    const args = Reflect.getMetadata(
      '__routeArguments__',
      KubernetesHubApiController,
      'manageKubernatesManifest',
    ) as Record<string, unknown>;
    expect(Object.keys(args)).toEqual(['3:0']);
  });

  const dto: ManageKubernetesDto = {
    numberOfTickets: 3,
    namespace: 'default',
    action: KubernetesAction.APPLY,
    manifest: 'kind: Pod',
  };

  it('delegates to the service and returns its result untouched', async () => {
    const result = {
      executionResult: { success: true, stdout: '', stderr: '', exitCode: 0 },
      logId: 'log-1',
    } satisfies OperationResult;
    service.manageKubernatesManifest.mockResolvedValue(result);

    await expect(controller.manageKubernatesManifest(dto)).resolves.toBe(
      result,
    );

    expect(service.manageKubernatesManifest).toHaveBeenCalledWith(dto);
  });

  it('propagates the service errors', async () => {
    service.manageKubernatesManifest.mockRejectedValue(new Error('boom'));

    await expect(controller.manageKubernatesManifest(dto)).rejects.toThrow(
      'boom',
    );
  });
});
