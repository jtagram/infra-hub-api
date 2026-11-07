import { describe, expect, it } from '@jest/globals';
import { ResponseBody } from '../../../../common/dto/response-body.dto';
import { DatabaseHubApiMapper } from '../../database-hub-api.mapper';

const RESULT = { success: true, stdout: 'ok', stderr: '', exitCode: 0 };

describe('DatabaseHubApiMapper responses', () => {
	it('wraps the database names in a success envelope', () => {
		const body = DatabaseHubApiMapper.toListDatabasesResponse(['a', 'b']);

		expect(body).toBeInstanceOf(ResponseBody);
		expect(body).toEqual({
			ok: true,
			msg: 'Databases retrieved successfully',
			data: { databases: ['a', 'b'] },
		});
	});

	it('wraps the manage-database outcome and log id', () => {
		expect(DatabaseHubApiMapper.toManageDatabaseResponse(RESULT, 'log-1')).toEqual({
			ok: true,
			msg: 'Database operation executed',
			data: { executionResult: RESULT, logId: 'log-1' },
		});
	});

	it('wraps the create-database outcome and log id', () => {
		expect(DatabaseHubApiMapper.toCreateDatabaseResponse(RESULT, 'log-2')).toEqual({
			ok: true,
			msg: 'Database creation executed',
			data: { executionResult: RESULT, logId: 'log-2' },
		});
	});

	it('reports a failed playbook inside a success envelope', () => {
		const failed = { ...RESULT, success: false, exitCode: 2 };

		const body = DatabaseHubApiMapper.toManageDatabaseResponse(failed, 'log-3');

		expect(body.ok).toBe(true);
		expect(body.data?.executionResult.success).toBe(false);
	});
});
