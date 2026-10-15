import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Logger } from 'nestjs-pino';
import { GENERIC_ERROR_MESSAGE } from './generic-error-message';

@Catch()
export class UnknownExceptionFilter implements ExceptionFilter {
	constructor(private readonly logger: Logger) {}

	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const isError = exception instanceof Error;

		this.logger.error({
			err: {
				message: isError ? exception.message : String(exception),
				stack: isError ? exception.stack : undefined,
			},
			errorType: isError ? exception.constructor.name : typeof exception,
			msg: 'Unhandled exception',
		});

		response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
			statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
			message: GENERIC_ERROR_MESSAGE,
		});
	}
}
