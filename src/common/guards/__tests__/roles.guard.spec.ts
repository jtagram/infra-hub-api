import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Role } from '../../roles/role.enum';
import { ROLES_KEY } from '../roles.decorator';
import { RolesGuard } from '../roles.guard';

// @nestjs/config is ESM-only and Jest runs as CommonJS. The guard is built by
// hand below, so only the class token needs to exist.
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));

const APPLICATION_NAME = 'infra-hub-api';

const buildUser = (applicationName: string, roleNames: string[]) => ({
  apps: {
    application: {
      id: 1,
      name: applicationName,
      description: 'app',
      roles: roleNames.map((name, index) => ({
        id: index + 1,
        name,
        description: name,
      })),
    },
  },
});

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let configService: { get: jest.Mock };
  let guard: RolesGuard;
  let request: Record<string, unknown>;
  const handler = function handler() {};
  class Controller {}

  const buildContext = (user?: unknown): ExecutionContext => {
    request = user === undefined ? {} : { user };
    return {
      getHandler: () => handler,
      getClass: () => Controller,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]) };
    configService = { get: jest.fn().mockReturnValue(APPLICATION_NAME) };
    guard = new RolesGuard(
      reflector as unknown as Reflector,
      configService as unknown as ConfigService,
    );
  });

  it('reads the roles metadata from the handler and the class', () => {
    guard.canActivate(buildContext(buildUser(APPLICATION_NAME, ['ADMIN'])));

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      handler,
      Controller,
    ]);
  });

  it('allows a route without required roles, even without a user', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('allows a route whose required roles list is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('rejects with 403 when there is no authenticated user', () => {
    expect(() => guard.canActivate(buildContext())).toThrow(
      new ForbiddenException(
        'RolesGuard ran without an authenticated user - JwtAuthGuard must run first',
      ),
    );
  });

  it('rejects a token issued for another application even with the ADMIN role', () => {
    const context = buildContext(buildUser('iam', ['ADMIN']));

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException(
        'This token was not issued for the infra-hub-api application',
      ),
    );
  });

  it('reads the application name from INFRA_HUB_API_APPLICATION_NAME', () => {
    guard.canActivate(buildContext(buildUser(APPLICATION_NAME, ['ADMIN'])));

    expect(configService.get).toHaveBeenCalledWith(
      'INFRA_HUB_API_APPLICATION_NAME',
    );
  });

  it('rejects a user of this application without the required role', () => {
    const context = buildContext(buildUser(APPLICATION_NAME, ['VIEWER']));

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('You do not have the required role'),
    );
  });

  it('rejects a user of this application with no roles at all', () => {
    const context = buildContext(buildUser(APPLICATION_NAME, []));

    expect(() => guard.canActivate(context)).toThrow(
      'You do not have the required role',
    );
  });

  it('allows an ADMIN of this application', () => {
    const context = buildContext(buildUser(APPLICATION_NAME, ['ADMIN']));

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a user that has the required role among several roles', () => {
    const context = buildContext(
      buildUser(APPLICATION_NAME, ['VIEWER', 'ADMIN']),
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('compares role names case-sensitively', () => {
    const context = buildContext(buildUser(APPLICATION_NAME, ['admin']));

    expect(() => guard.canActivate(context)).toThrow(
      'You do not have the required role',
    );
  });

  it('allows when the user has any one of several required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['OTHER', Role.ADMIN]);
    const context = buildContext(buildUser(APPLICATION_NAME, ['ADMIN']));

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects when the configured application name is missing and the token names another app', () => {
    configService.get.mockReturnValue(undefined);
    const context = buildContext(buildUser(APPLICATION_NAME, ['ADMIN']));

    expect(() => guard.canActivate(context)).toThrow(
      'This token was not issued for the infra-hub-api application',
    );
  });
});
