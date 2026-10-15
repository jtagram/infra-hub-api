import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
	ArgumentsHost,
	BadRequestException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { HttpExceptionFilter } from '../http-exception.filter';

describe('HttpExceptionFilter', () => {
	let logger: { warn: jest.Mock; error: jest.Mock };
	let json: jest.Mock;
	let status: jest.Mock;
	let host: ArgumentsHost;
	let filter: HttpExceptionFilter;

	beforeEach(() => {
		logger = { warn: jest.fn(), error: jest.fn() };
		json = jest.fn();
		status = jest.fn().mockReturnValue({ json });
		host = {
			switchToHttp: () => ({ getResponse: () => ({ status }) }),
		} as unknown as ArgumentsHost;
		filter = new HttpExceptionFilter(logger as unknown as Logger);
	});

	it('answers with the exception status and its own response body', () => {
		const exception = new BadRequestException(['name must not be empty']);

		filter.catch(exception, host);

		expect(status).toHaveBeenCalledWith(400);
		expect(json).toHaveBeenCalledWith(exception.getResponse());
	});

	it('keeps a custom object body untouched', () => {
		const body = { statusCode: 422, message: 'custom', extra: true };

		filter.catch(new HttpException(body, 422), host);

		expect(status).toHaveBeenCalledWith(422);
		expect(json).toHaveBeenCalledWith(body);
	});

	it('keeps a plain string body untouched', () => {
		filter.catch(new HttpException('plain text', HttpStatus.CONFLICT), host);

		expect(status).toHaveBeenCalledWith(409);
		expect(json).toHaveBeenCalledWith('plain text');
	});

	it('logs a 4xx exception as a warning, not as an error', () => {
		filter.catch(new NotFoundException('missing'), host);

		expect(logger.warn).toHaveBeenCalledTimes(1);
		expect(logger.error).not.toHaveBeenCalled();
	});

	it('logs a 499 exception as a warning', () => {
		filter.catch(new HttpException('edge', 499), host);

		expect(logger.warn).toHaveBeenCalledTimes(1);
		expect(logger.error).not.toHaveBeenCalled();
	});

	it('logs a 500 exception as an error, not as a warning', () => {
		filter.catch(new InternalServerErrorException('boom'), host);

		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it('logs a 502 exception as an error', () => {
		filter.catch(new HttpException('bad gateway', 502), host);

		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it('logs the error details, type, status code and response', () => {
		const exception = new ForbiddenException('nope');

		filter.catch(exception, host);

		expect(logger.warn).toHaveBeenCalledWith({
			err: { message: 'nope', stack: exception.stack },
			errorType: 'ForbiddenException',
			statusCode: 403,
			details: exception.getResponse(),
			msg: 'HTTP exception',
		});
	});
});
