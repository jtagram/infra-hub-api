import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ManageServerDto } from '../../server-hub-api.dto';

// Same options main.ts gives the global ValidationPipe (transform only affects
// the returned instance, not what is accepted).
const validateDto = (payload: Record<string, unknown>) =>
  validate(plainToInstance(ManageServerDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
const propertiesWithErrors = async (payload: Record<string, unknown>) =>
  (await validateDto(payload)).map((error) => error.property);

const valid = () => ({
  numberOfTickets: 21,
  playbook: '- hosts: all\n  tasks: []\n',
});

describe('ManageServerDto', () => {
  it('accepts a valid payload', async () => {
    expect(await validateDto(valid())).toHaveLength(0);
  });

  it('rejects a missing numberOfTickets', async () => {
    expect(await propertiesWithErrors({ playbook: valid().playbook })).toEqual([
      'numberOfTickets',
    ]);
  });

  it('rejects a string or decimal numberOfTickets', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), numberOfTickets: '21' }),
    ).toEqual(['numberOfTickets']);
    expect(
      await propertiesWithErrors({ ...valid(), numberOfTickets: 21.5 }),
    ).toEqual(['numberOfTickets']);
  });

  it('rejects a missing or empty playbook', async () => {
    expect(await propertiesWithErrors({ numberOfTickets: 1 })).toEqual([
      'playbook',
    ]);
    expect(await propertiesWithErrors({ ...valid(), playbook: '' })).toEqual([
      'playbook',
    ]);
  });

  it('accepts a playbook of 20000 characters and rejects 20001', async () => {
    expect(
      await validateDto({ ...valid(), playbook: 'x'.repeat(20000) }),
    ).toHaveLength(0);
    expect(
      await propertiesWithErrors({ ...valid(), playbook: 'x'.repeat(20001) }),
    ).toEqual(['playbook']);
  });

  it('rejects a playbook that is not a string', async () => {
    expect(
      await propertiesWithErrors({ ...valid(), playbook: [{ hosts: 'all' }] }),
    ).toEqual(['playbook']);
  });

  it('does not validate the playbook content (that is the job of AnsibleValidator)', async () => {
    expect(
      await validateDto({
        ...valid(),
        playbook: 'definitely: not [a playbook',
      }),
    ).toHaveLength(0);
  });

  it('rejects properties that are not part of the DTO', async () => {
    expect(await propertiesWithErrors({ ...valid(), hosts: 'all' })).toEqual([
      'hosts',
    ]);
  });
});
