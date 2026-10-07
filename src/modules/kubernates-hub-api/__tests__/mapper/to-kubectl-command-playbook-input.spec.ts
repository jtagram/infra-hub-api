import { describe, expect, it } from '@jest/globals';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
} from '../../../../common/database/infrastructure-operatios-log.entity';
import { AnsibleExecutionResult } from '../../../ansible/ansible.dto';
import {
  ExecuteKubectlCommandDto,
  ManageKubernetesDto,
} from '../../kubernates-hub-api.dto';
import { KubernetesHubApiMapper } from '../../kubernates-hub-api.mapper';
import {
  KubectlCommandPlaybookInput,
  KubernetesAction,
  KubernetesManifestPlaybookInput,
} from '../../kubernates-hub-api.playbook';

const manageDto: ManageKubernetesDto = {
  numberOfTickets: 14,
  namespace: 'prod',
  action: KubernetesAction.DELETE,
  manifest: 'kind: Pod\nmetadata:\n  name: x',
};
const kubectlDto: ExecuteKubectlCommandDto = {
  numberOfTickets: 15,
  kubectlCommand: 'get pods -A',
};
const result: AnsibleExecutionResult = {
  success: true,
  stdout: 'deleted',
  stderr: '',
  exitCode: 0,
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
