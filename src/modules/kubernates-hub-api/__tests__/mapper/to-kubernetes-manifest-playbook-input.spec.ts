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

describe('KubernetesHubApiMapper.toKubernetesManifestPlaybookInput', () => {
  it('maps namespace, action and manifest', () => {
    expect(
      KubernetesHubApiMapper.toKubernetesManifestPlaybookInput(manageDto),
    ).toEqual({
      namespace: 'prod',
      action: 'delete',
      manifest: 'kind: Pod\nmetadata:\n  name: x',
    });
  });

  it('returns a KubernetesManifestPlaybookInput', () => {
    expect(
      KubernetesHubApiMapper.toKubernetesManifestPlaybookInput(manageDto),
    ).toBeInstanceOf(KubernetesManifestPlaybookInput);
  });

  it('does not carry the ticket number into the playbook input', () => {
    expect(
      KubernetesHubApiMapper.toKubernetesManifestPlaybookInput(manageDto),
    ).not.toHaveProperty('numberOfTickets');
  });
});
