import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

export const ApiGetHello = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Health greeting',
			description:
				'Public endpoint that returns a greeting wrapped in the standard response envelope. It requires no authentication.',
		}),
		ApiOkResponse({
			description: 'Greeting wrapped in the `{ ok, msg, data }` envelope.',
			schema: {
				type: 'object',
				required: ['ok', 'msg', 'data'],
				properties: {
					ok: { type: 'boolean', example: true },
					msg: { type: 'string', example: 'Service is running' },
					data: { type: 'string', example: 'Hello World!' },
				},
			},
		}),
	);
