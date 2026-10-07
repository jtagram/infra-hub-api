import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ManageKubernetesDto } from '../../kubernates-hub-api.dto';

// Same options main.ts gives the global ValidationPipe (transform only affects
// the returned instance, not what is accepted).
const validateDto = (payload: Record<string, unknown>) =>
  validate(plainToInstance(ManageKubernetesDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
const propertiesWithErrors = async (payload: Record<string, unknown>) =>
  (await validateDto(payload)).map((error) => error.property);

const valid = () => ({
  numberOfTickets: 10,
  namespace: 'default',
  action: 'apply',
  manifest: 'apiVersion: v1\nkind: Pod',
});

describe('ManageKubernetesDto', () => {
  it('accepts a valid payload', async () => {
    expect(await validateDto(valid())).toHaveLength(0);
  });

  it('accepts apply, delete and create as action', async () => {
    for (const action of ['apply', 'delete', 'create']) {
      expect(await validateDto({ ...valid(), action })).toHaveLength(0);
    }
  });

  it('rejects an unknown action', async () => {
    expect(await propertiesWithErrors({ ...valid(), action: 'exec' })).toEqual([
      'action',
    ]);
  });

  it('rejects an action in another case', async () => {
    expect(await propertiesWithErrors({ ...valid(), action: 'APPLY' })).toEqual(
      ['action'],
    );
  });

  it('rejects a missing action', async () => {
    const { action, ...payload } = valid();

    expect(await propertiesWithErrors(payload)).toEqual(['action']);
  });

  it('rejects a missing numberOfTickets', async () => {
    const { numberOfTickets, ...payload } = valid();

    expect(await propertiesWithErrors(payload)).toEqual(['numberOfTickets']);
  });

  it('rejects a string or decimal numberOfTickets', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), numberOfTickets: '10' }),
    ).toEqual(['numberOfTickets']);
    expect(
      await propertiesWithErrors({ ...valid(), numberOfTickets: 10.5 }),
    ).toEqual(['numberOfTickets']);
  });

  it('rejects a missing or empty namespace', async () => {
    const { namespace, ...payload } = valid();

    expect(await propertiesWithErrors(payload)).toEqual(['namespace']);
    expect(await propertiesWithErrors({ ...valid(), namespace: '' })).toEqual([
      'namespace',
    ]);
  });

  it('accepts a namespace of 63 characters and rejects 64', async () => {
    expect(
      await validateDto({ ...valid(), namespace: 'n'.repeat(63) }),
    ).toHaveLength(0);
    expect(
      await propertiesWithErrors({ ...valid(), namespace: 'n'.repeat(64) }),
    ).toEqual(['namespace']);
  });

  it('does not restrict the characters of namespace (no DNS label pattern)', async () => {
    expect(
      await validateDto({ ...valid(), namespace: '--all-namespaces' }),
    ).toHaveLength(0);
  });

  it('rejects a missing or empty manifest', async () => {
    const { manifest, ...payload } = valid();

    expect(await propertiesWithErrors(payload)).toEqual(['manifest']);
    expect(await propertiesWithErrors({ ...valid(), manifest: '' })).toEqual([
      'manifest',
    ]);
  });

  it('accepts a manifest of 20000 characters and rejects 20001', async () => {
    expect(
      await validateDto({ ...valid(), manifest: 'x'.repeat(20000) }),
    ).toHaveLength(0);
    expect(
      await propertiesWithErrors({ ...valid(), manifest: 'x'.repeat(20001) }),
    ).toEqual(['manifest']);
  });

  it('rejects a manifest that is not a string', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), manifest: { kind: 'Pod' } }),
    ).toEqual(['manifest']);
  });

  it('does not check that the manifest is valid YAML', async () => {
    expect(
      await validateDto({ ...valid(), manifest: '{{ not: [yaml' }),
    ).toHaveLength(0);
  });

  it('rejects properties that are not part of the DTO', async () => {
    expect(await propertiesWithErrors({ ...valid(), extra: 1 })).toEqual([
      'extra',
    ]);
  });
});
