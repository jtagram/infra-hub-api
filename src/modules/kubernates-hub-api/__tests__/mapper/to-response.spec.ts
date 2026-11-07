import { describe, expect, it } from '@jest/globals';
import { ResponseBody } from '../../../../common/dto/response-body.dto';
import { KubernetesHubApiMapper } from '../../kubernates-hub-api.mapper';

const RESULT = { success: true, stdout: 'ok', stderr: '', exitCode: 0 };

describe('KubernetesHubApiMapper responses', () => {
	it('wraps the deployment names in a success envelope', () => {
		const body = KubernetesHubApiMapper.toListDeploymentsResponse(['api']);

		expect(body).toBeInstanceOf(ResponseBody);
		expect(body).toEqual({
			ok: true,
			msg: 'Deployments retrieved successfully',
			data: { deployments: ['api'] },
		});
	});

	it('wraps the manifest outcome and log id', () => {
		expect(KubernetesHubApiMapper.toManageManifestResponse(RESULT, 'log-1')).toEqual({
			ok: true,
			msg: 'Kubernetes manifest operation executed',
			data: { executionResult: RESULT, logId: 'log-1' },
		});
	});

	it('wraps the kubectl outcome and log id', () => {
		expect(KubernetesHubApiMapper.toKubectlCommandResponse(RESULT, 'log-2')).toEqual({
			ok: true,
			msg: 'Kubectl command executed',
			data: { executionResult: RESULT, logId: 'log-2' },
		});
	});
});
