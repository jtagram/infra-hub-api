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

describe('KubernetesHubApiMapper.toOperationsLogEntity', () => {
  it('builds a KUBERNETES log entity', () => {
    const entity = KubernetesHubApiMapper.toOperationsLogEntity(
      manageDto,
      result,
    );

    expect(entity).toBeInstanceOf(InfrastructureOperationsLogEntity);
    expect(entity.department).toBe(InfrastructureDepartment.KUBERNETES);
  });

  it('uses the ticket number of the dto', () => {
    expect(
      KubernetesHubApiMapper.toOperationsLogEntity(manageDto, result)
        .numberOfTicket,
    ).toBe(14);
  });

  it('stores the action and manifest as JSON in the instruction', () => {
    const entity = KubernetesHubApiMapper.toOperationsLogEntity(
      manageDto,
      result,
    );

    expect(JSON.parse(entity.instruction)).toEqual({
      action: 'delete',
      manifest: 'kind: Pod\nmetadata:\n  name: x',
    });
  });

  it('does not store the namespace in the instruction', () => {
    const entity = KubernetesHubApiMapper.toOperationsLogEntity(
      manageDto,
      result,
    );

    expect(JSON.parse(entity.instruction)).not.toHaveProperty('namespace');
  });

  it('stores the whole execution result as JSON in the response', () => {
    const entity = KubernetesHubApiMapper.toOperationsLogEntity(
      manageDto,
      result,
    );

    expect(JSON.parse(entity.response)).toEqual(result);
  });
});
