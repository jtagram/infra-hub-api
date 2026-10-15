import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Logger } from 'nestjs-pino';
import { TypeORMError } from 'typeorm';
import { GENERIC_ERROR_MESSAGE } from './generic-error-message';

@Catch(TypeORMError)
export class DatabaseExceptionFilter implements ExceptionFilter {
	constructor(private readonly logger: Logger) {}

	catch(exception: TypeORMError, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();

		this.logger.error({
			err: {
				message: exception.message,
				stack: exception.stack,
			},
			errorType: exception.constructor.name,
			query: (exception as { query?: string }).query,
			msg: 'Database error',
		});

		response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
			statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
			message: GENERIC_ERROR_MESSAGE,
		});
	}
}
