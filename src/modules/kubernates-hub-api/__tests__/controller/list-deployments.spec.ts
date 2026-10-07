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

describe('KubernetesHubApiController.listDeployments', () => {
  let service: {
    listDeployments: jest.Mock<(dto: ListDeploymentsDto) => Promise<unknown>>;
  };
  let controller: KubernetesHubApiController;
  const handler = KubernetesHubApiController.prototype.listDeployments;

  beforeEach(() => {
    service = {
      listDeployments: jest.fn<(dto: ListDeploymentsDto) => Promise<unknown>>(),
    };
    controller = new KubernetesHubApiController(
      service as unknown as KubernetesHubApiService,
    );
  });

  it('is mounted at GET /kubernates-hub-api/list-deployments', () => {
    expect(Reflect.getMetadata('path', KubernetesHubApiController)).toBe(
      'kubernates-hub-api',
    );
    expect(Reflect.getMetadata('path', handler)).toBe('list-deployments');
    expect(Reflect.getMetadata('method', handler)).toBe(RequestMethod.GET);
  });

  it('requires the ADMIN role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.ADMIN]);
  });

  it('binds the query string to ListDeploymentsDto', () => {
    expect(
      Reflect.getMetadata(
        'design:paramtypes',
        KubernetesHubApiController.prototype,
        'listDeployments',
      ),
    ).toEqual([ListDeploymentsDto]);
    const args = Reflect.getMetadata(
      '__routeArguments__',
      KubernetesHubApiController,
      'listDeployments',
    ) as Record<string, unknown>;
    expect(Object.keys(args)).toEqual(['4:0']);
  });

  it('delegates to the service and wraps the names in { deployments }', async () => {
    service.listDeployments.mockResolvedValue(['api', 'web']);
    const dto = { namespace: 'default' };

    await expect(controller.listDeployments(dto)).resolves.toEqual({
      deployments: ['api', 'web'],
    });

    expect(service.listDeployments).toHaveBeenCalledWith(dto);
  });

  it('returns an empty list when the namespace has no deployments', async () => {
    service.listDeployments.mockResolvedValue([]);

    await expect(
      controller.listDeployments({ namespace: 'x' }),
    ).resolves.toEqual({
      deployments: [],
    });
  });

  it('propagates the service errors', async () => {
    service.listDeployments.mockRejectedValue(new Error('bad gateway'));

    await expect(
      controller.listDeployments({ namespace: 'x' }),
    ).rejects.toThrow('bad gateway');
  });
});
