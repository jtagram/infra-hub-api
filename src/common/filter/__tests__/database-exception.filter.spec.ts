import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ArgumentsHost } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { QueryFailedError, TypeORMError } from 'typeorm';
import { DatabaseExceptionFilter } from '../database-exception.filter';
import { GENERIC_ERROR_MESSAGE } from '../generic-error-message';

describe('DatabaseExceptionFilter', () => {
	let logger: { error: jest.Mock };
	let json: jest.Mock;
	let status: jest.Mock;
	let host: ArgumentsHost;
	let filter: DatabaseExceptionFilter;

	beforeEach(() => {
		logger = { error: jest.fn() };
		json = jest.fn();
		status = jest.fn().mockReturnValue({ json });
		host = {
			switchToHttp: () => ({ getResponse: () => ({ status }) }),
		} as unknown as ArgumentsHost;
		filter = new DatabaseExceptionFilter(logger as unknown as Logger);
	});

	it('answers 500 with the generic message', () => {
		filter.catch(new TypeORMError('connection lost'), host);

		expect(status).toHaveBeenCalledWith(500);
		expect(json).toHaveBeenCalledWith({
			statusCode: 500,
			message: GENERIC_ERROR_MESSAGE,
		});
	});

	it('does not expose the database error message nor the query to the client', () => {
		const error = new QueryFailedError(
			'SELECT secret FROM users',
			[],
			new Error('relation "users" does not exist'),
		);

		filter.catch(error, host);

		const body = JSON.stringify(json.mock.calls);
		expect(body).not.toContain('users');
		expect(body).not.toContain('SELECT');
	});

	it('logs message, stack and class name of a generic TypeORMError', () => {
		const error = new TypeORMError('connection lost');

		filter.catch(error, host);

		expect(logger.error).toHaveBeenCalledWith({
			err: { message: 'connection lost', stack: error.stack },
			errorType: 'TypeORMError',
			query: undefined,
			msg: 'Database error',
		});
	});

	it('logs the failing query of a QueryFailedError', () => {
		const error = new QueryFailedError(
			'SELECT 1 FROM infrastructure_operations_log',
			[],
			new Error('boom'),
		);

		filter.catch(error, host);

		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error.mock.calls[0][0]).toMatchObject({
			errorType: 'QueryFailedError',
			query: 'SELECT 1 FROM infrastructure_operations_log',
			msg: 'Database error',
		});
	});
});
