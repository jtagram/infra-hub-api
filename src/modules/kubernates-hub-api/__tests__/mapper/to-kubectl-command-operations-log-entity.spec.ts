import { describe, expect, it } from '@jest/globals';
import {
  InfrastructureDepartment,
  InfrastructureOperationsLogEntity,
} from '../../../../common/database/infrastructure-operatios-log.entity';
import { AnsibleExecutionResult } from '../../../ansible/ansible.dto';
import { ExecuteKubectlCommandDto } from '../../kubernates-hub-api.dto';
import { KubernetesHubApiMapper } from '../../kubernates-hub-api.mapper';

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

describe('KubernetesHubApiMapper.toKubectlCommandOperationsLogEntity', () => {
  it('builds a KUBERNETES log entity', () => {
    const entity = KubernetesHubApiMapper.toKubectlCommandOperationsLogEntity(
      kubectlDto,
      result,
    );

    expect(entity).toBeInstanceOf(InfrastructureOperationsLogEntity);
    expect(entity.department).toBe(InfrastructureDepartment.KUBERNETES);
  });

  it('uses the ticket number of the dto', () => {
    expect(
      KubernetesHubApiMapper.toKubectlCommandOperationsLogEntity(
        kubectlDto,
        result,
      ).numberOfTicket,
    ).toBe(15);
  });

  it('stores the kubectl command as JSON in the instruction', () => {
    const entity = KubernetesHubApiMapper.toKubectlCommandOperationsLogEntity(
      kubectlDto,
      result,
    );

    expect(JSON.parse(entity.instruction)).toEqual({
      kubectlCommand: 'get pods -A',
    });
  });

  it('stores the whole execution result as JSON in the response', () => {
    const entity = KubernetesHubApiMapper.toKubectlCommandOperationsLogEntity(
      kubectlDto,
      result,
    );

    expect(JSON.parse(entity.response)).toEqual(result);
  });
});
