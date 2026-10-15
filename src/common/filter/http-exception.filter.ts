import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { Logger } from 'nestjs-pino';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
	constructor(private readonly logger: Logger) {}

	catch(exception: HttpException, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const status = exception.getStatus();
		const level = status >= 500 ? 'error' : 'warn';

		this.logger[level]({
			err: {
				message: exception.message,
				stack: exception.stack,
			},
			errorType: exception.constructor.name,
			statusCode: status,
			details: exception.getResponse(),
			msg: 'HTTP exception',
		});

		response.status(status).json(exception.getResponse());
	}
}
