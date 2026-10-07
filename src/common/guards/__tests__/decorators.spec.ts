import { describe, expect, it } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { Role } from '../../roles/role.enum';
import { IS_PUBLIC_KEY, Public } from '../public.decorator';
import { ROLES_KEY, Roles } from '../roles.decorator';

describe('@Public', () => {
  it('uses "isPublic" as metadata key', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('marks a method as public', () => {
    class Sample {
      @Public()
      open(): void {}
    }

    expect(new Reflector().get(IS_PUBLIC_KEY, Sample.prototype.open)).toBe(
      true,
    );
  });

  it('marks a whole class as public', () => {
    @Public()
    class Sample {}

    expect(new Reflector().get(IS_PUBLIC_KEY, Sample)).toBe(true);
  });

  it('leaves undecorated handlers without metadata', () => {
    class Sample {
      closed(): void {}
    }

    expect(
      new Reflector().get(IS_PUBLIC_KEY, Sample.prototype.closed),
    ).toBeUndefined();
  });
});

describe('@Roles', () => {
  it('uses "roles" as metadata key', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  it('stores the given roles on a method', () => {
    class Sample {
      @Roles(Role.ADMIN)
      restricted(): void {}
    }

    expect(new Reflector().get(ROLES_KEY, Sample.prototype.restricted)).toEqual(
      [Role.ADMIN],
    );
  });

  it('stores the given roles on a class', () => {
    @Roles(Role.ADMIN)
    class Sample {}

    expect(new Reflector().get(ROLES_KEY, Sample)).toEqual([Role.ADMIN]);
  });

  it('stores an empty list when called without roles', () => {
    class Sample {
      @Roles()
      anyone(): void {}
    }

    expect(new Reflector().get(ROLES_KEY, Sample.prototype.anyone)).toEqual([]);
  });

  it('exposes ADMIN as the only role of the application', () => {
    expect(Object.values(Role)).toEqual(['ADMIN']);
  });
});
