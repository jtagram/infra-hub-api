import { describe, expect, it } from '@jest/globals';
import { ResponseBody } from '../../../../common/dto/response-body.dto';
import { ServerHubApiMapper } from '../../server-hub-api.mapper';

const RESULT = { success: true, stdout: 'ok', stderr: '', exitCode: 0 };

describe('ServerHubApiMapper.toManageServerResponse', () => {
	it('wraps the playbook outcome and log id in a success envelope', () => {
		const body = ServerHubApiMapper.toManageServerResponse(RESULT, 'log-1');

		expect(body).toBeInstanceOf(ResponseBody);
		expect(body).toEqual({
			ok: true,
			msg: 'Server playbook executed',
			data: { executionResult: RESULT, logId: 'log-1' },
		});
	});
});
