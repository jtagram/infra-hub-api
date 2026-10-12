import { describe, expect, it } from '@jest/globals';
import { ExecuteKubectlCommandDto } from '../../kubernates-hub-api.dto';
import { KubernetesHubApiMapper } from '../../kubernates-hub-api.mapper';
import { KubectlCommandPlaybookInput } from '../../kubernates-hub-api.playbook';

const kubectlDto: ExecuteKubectlCommandDto = {
  numberOfTickets: 15,
  kubectlCommand: 'get pods -A',
};
describe('KubernetesHubApiMapper.toKubectlCommandPlaybookInput', () => {
  it('maps the kubectl command', () => {
    expect(
      KubernetesHubApiMapper.toKubectlCommandPlaybookInput(kubectlDto),
    ).toEqual({ kubectlCommand: 'get pods -A' });
  });

  it('returns a KubectlCommandPlaybookInput', () => {
    expect(
      KubernetesHubApiMapper.toKubectlCommandPlaybookInput(kubectlDto),
    ).toBeInstanceOf(KubectlCommandPlaybookInput);
  });

  it('passes the command verbatim, without trimming', () => {
    expect(
      KubernetesHubApiMapper.toKubectlCommandPlaybookInput({
        ...kubectlDto,
        kubectlCommand: '  get   pods  ',
      }).kubectlCommand,
    ).toBe('  get   pods  ');
  });
});
