import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { Logger } from 'nestjs-pino';
import { ResponseBody } from '../dto/response-body.dto';

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

		response.status(status).json(ResponseBody.failure(this.messageOf(exception)));
	}

	/** Extracts a plain string message; validation arrays are joined with ', '. */
	private messageOf(exception: HttpException): string {
		const body = exception.getResponse();
		const message = typeof body === 'string' ? body : (body as { message?: unknown }).message;

		if (Array.isArray(message)) {
			return message.join(', ');
		}
		return typeof message === 'string' ? message : exception.message;
	}
}
