import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ExecuteKubectlCommandDto } from '../../kubernates-hub-api.dto';

// Same options main.ts gives the global ValidationPipe (transform only affects
// the returned instance, not what is accepted).
const validateDto = (payload: Record<string, unknown>) =>
  validate(plainToInstance(ExecuteKubectlCommandDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
const propertiesWithErrors = async (payload: Record<string, unknown>) =>
  (await validateDto(payload)).map((error) => error.property);

const valid = () => ({ numberOfTickets: 2, kubectlCommand: 'get pods' });

describe('ExecuteKubectlCommandDto', () => {
  it('accepts a valid payload', async () => {
    expect(await validateDto(valid())).toHaveLength(0);
  });

  it('rejects a missing numberOfTickets', async () => {
    expect(await propertiesWithErrors({ kubectlCommand: 'get pods' })).toEqual([
      'numberOfTickets',
    ]);
  });

  it('rejects a string or decimal numberOfTickets', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), numberOfTickets: '2' }),
    ).toEqual(['numberOfTickets']);
    expect(
      await propertiesWithErrors({ ...valid(), numberOfTickets: 0.5 }),
    ).toEqual(['numberOfTickets']);
  });

  it('rejects a missing or empty kubectlCommand', async () => {
    expect(await propertiesWithErrors({ numberOfTickets: 1 })).toEqual([
      'kubectlCommand',
    ]);
    expect(
      await propertiesWithErrors({ ...valid(), kubectlCommand: '' }),
    ).toEqual(['kubectlCommand']);
  });

  it('accepts a command of 4000 characters and rejects 4001', async () => {
    expect(
      await validateDto({ ...valid(), kubectlCommand: 'x'.repeat(4000) }),
    ).toHaveLength(0);
    expect(
      await propertiesWithErrors({
        ...valid(),
        kubectlCommand: 'x'.repeat(4001),
      }),
    ).toEqual(['kubectlCommand']);
  });

  it('accepts a whitespace-only command (it becomes an empty kubectl argument)', async () => {
    expect(
      await validateDto({ ...valid(), kubectlCommand: '   ' }),
    ).toHaveLength(0);
  });

  it('does not restrict which kubectl verbs or flags are allowed', async () => {
    expect(
      await validateDto({
        ...valid(),
        kubectlCommand: 'delete namespace production --kubeconfig /etc/x',
      }),
    ).toHaveLength(0);
  });

  it('rejects a kubectlCommand that is not a string', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), kubectlCommand: ['get'] }),
    ).toEqual(['kubectlCommand']);
  });

  it('rejects properties that are not part of the DTO', async () => {
    expect(await propertiesWithErrors({ ...valid(), namespace: 'x' })).toEqual([
      'namespace',
    ]);
  });
});
